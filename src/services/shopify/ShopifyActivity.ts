import { ShopifyClientAccessor } from './ShopifyClientAccessor';
import { FETCH_PRODUCTS, FETCH_ORDERS, FETCH_COLLECTIONS, FETCH_OPEN_ORDERS } from './queries/ShopifyQueries';
import { ShopifyProduct, ShopifyOrder, ShopifyCollection, ProcessedShopifyOrder } from './types/ShopifyTypes';
import { FirebaseClientAccessor } from '../firebase/FirebaseClientAccessor';
import { collection, addDoc, query, where, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { gql } from 'graphql-request';

interface ShopifyResponse<T> {
  [key: string]: {
    edges: Array<{
      node: T;
      cursor: string;
    }>;
  };
}

interface LineItemEdge {
  node: {
    title: string;
    quantity: number;
    variant: {
      title: string;
      price: string;
    };
  };
}

interface OrdersResponse {
  orders: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
    edges: Array<{
      node: {
        id: string;
        name: string;
        createdAt: string;
        displayFulfillmentStatus: string;
        displayFinancialStatus: string;
        customer?: {
          firstName?: string;
          lastName?: string;
          email?: string;
        };
        lineItems: {
          edges: Array<{
            node: {
              id: string;
              title: string;
              quantity: number;
              originalUnitPrice?: string;
              variant?: {
                id: string;
                title: string;
                price: string;
                sku?: string;
              };
            };
          }>;
        };
        [key: string]: any; // For other fields
      };
    }>;
  };
}

export class ShopifyActivity {
  private client = ShopifyClientAccessor.getInstance().getClient();
  private db = FirebaseClientAccessor.getInstance().getDb();
  private processedIds = new Set<string>();
  private batchSize = 50; // Shopify recommended batch size

  private readonly GET_ALL_ORDERS_QUERY = gql`
    query getOrders($cursor: String) {
      orders(first: 50, after: $cursor, sortKey: CREATED_AT, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            id
            name
            createdAt
            displayFulfillmentStatus
            displayFinancialStatus
            customer {
              firstName
              lastName
              email
            }
            lineItems(first: 50) {
              edges {
                node {
                  id
                  title
                  quantity
                  originalUnitPrice
                  variant {
                    id
                    title
                    price
                    sku
                  }
                }
              }
            }
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            subtotalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            shippingAddress {
              address1
              address2
              city
              province
              zip
              country
              phone
            }
            fulfillments {
              status
              trackingInfo {
                number
                url
              }
            }
            tags
            note
          }
        }
      }
    }
  `;

  async getProducts(limit: number = 10): Promise<ShopifyProduct[]> {
    try {
      const data = await this.client.request<ShopifyResponse<ShopifyProduct>>(FETCH_PRODUCTS, { first: limit });
      return data.products.edges.map(edge => edge.node);
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  async getOrders(limit: number = 10): Promise<ShopifyOrder[]> {
    try {
      const data = await this.client.request<ShopifyResponse<ShopifyOrder>>(FETCH_ORDERS, { first: limit });
      return data.orders.edges.map((edge: any) => edge.node);
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  async getCollections(limit: number = 10): Promise<ShopifyCollection[]> {
    try {
      const data = await this.client.request<ShopifyResponse<ShopifyCollection>>(FETCH_COLLECTIONS, { first: limit });
      return data.collections.edges.map((edge: any) => edge.node);
    } catch (error) {
      console.error('Error fetching collections:', error);
      throw error;
    }
  }

  async getOpenOrders(limit: number = 50): Promise<ProcessedShopifyOrder[]> {
    try {
      console.log('Fetching open orders from Shopify...');
      const data = await this.client.request<ShopifyResponse<ShopifyOrder>>(
        FETCH_OPEN_ORDERS,
        { first: limit }
      );

      if (!data?.orders?.edges) {
        return [];
      }

      return data.orders.edges.map(edge => ({
        ...edge.node,
        lineItems: edge.node.lineItems.edges.map(item => ({
          title: item.node.title,
          quantity: item.node.quantity,
          variant: item.node.variant
        }))
      }));
    } catch (error) {
      console.error('Error fetching open orders:', error);
      throw error;
    }
  }

  async syncAllOrders() {
    console.group('Full Order Sync');
    console.time('Total Sync Time');
    
    try {
      let cursor: string | null = null;
      let hasNextPage = true;
      let totalProcessed = 0;
      let totalStored = 0;
      let batchNumber = 0;
      this.processedIds.clear();

      const startTime = Date.now();
      const batchStats: { [key: string]: any }[] = [];

      while (hasNextPage) {
        batchNumber++;
        const batchStartTime = Date.now();
        console.log(`\nProcessing Batch #${batchNumber}`);
        console.log(`Fetching orders after cursor: ${cursor || 'initial'}`);

        const data: OrdersResponse = await this.client.request<OrdersResponse>(
          this.GET_ALL_ORDERS_QUERY,
          { cursor }
        );
        const { orders } = data;

        if (!orders?.edges) {
          console.error('Invalid response format:', data);
          break;
        }

        const batch = orders.edges.map((edge: any) => edge.node);
        console.log(`Retrieved ${batch.length} orders in current batch`);

        // Process batch with batched writes
        const batchWrites = writeBatch(this.db);
        let batchCount = 0;

        for (const order of batch) {
          if (!this.processedIds.has(order.id)) {
            try {
              // Transform order data
              const transformedOrder = {
                ...order,
                lineItems: order.lineItems.edges.map((edge: any) => ({
                  id: edge.node.id,
                  title: edge.node.title,
                  quantity: edge.node.quantity,
                  originalUnitPrice: edge.node.originalUnitPrice,
                  variant: edge.node.variant
                })),
                syncedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
              };

              // Add to batch write
              const orderRef = doc(collection(this.db, 'shopify-orders'));
              batchWrites.set(orderRef, transformedOrder);
              
              this.processedIds.add(order.id);
              batchCount++;
              totalStored++;
            } catch (error) {
              console.error(`Error processing order ${order.id}:`, error);
            }
          }
          totalProcessed++;
        }

        // Commit batch if there are any writes
        if (batchCount > 0) {
          try {
            await batchWrites.commit();
            console.log(`Committed batch of ${batchCount} orders`);
          } catch (error) {
            console.error('Error committing batch:', error);
          }
        }

        const batchEndTime = Date.now();
        const batchDuration = batchEndTime - batchStartTime;

        const batchStat = {
          batchNumber,
          ordersInBatch: batch.length,
          newOrders: batchCount,
          duration: `${batchDuration}ms`,
          totalProcessed,
          totalStored,
          uniqueOrders: this.processedIds.size
        };
        batchStats.push(batchStat);

        console.log('Batch Statistics:', batchStat);

        // Update pagination
        hasNextPage = orders.pageInfo.hasNextPage;
        cursor = orders.pageInfo.endCursor;

        // Add a small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      const finalStats = {
        totalBatches: batchNumber,
        totalProcessed,
        totalStored,
        uniqueOrders: this.processedIds.size,
        totalDuration: `${totalDuration}ms`,
        averageTimePerBatch: `${totalDuration / batchNumber}ms`,
        batchStats
      };

      console.log('\nSync Complete:', finalStats);
      console.timeEnd('Total Sync Time');
      console.groupEnd();
      
      return {
        success: true,
        ...finalStats
      };

    } catch (error) {
      console.error('Error in syncAllOrders:', error);
      console.groupEnd();
      throw error;
    }
  }

  private async storeOrderInFirebase(order: any) {
    try {
      const ordersCollection = collection(this.db, 'shopify-orders');
      
      // Check if order already exists
      const q = query(ordersCollection, where("id", "==", order.id));
      const existing = await getDocs(q);
      
      if (!existing.empty) {
        console.log(`Order ${order.id} already exists, skipping`);
        return;
      }

      // Transform line items
      const lineItems = order.lineItems.edges.map((edge: any) => ({
        title: edge.node.title,
        quantity: edge.node.quantity,
        variant: edge.node.variant
      }));

      // Store the order
      const orderData = {
        ...order,
        lineItems,
        syncedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      await addDoc(ordersCollection, orderData);
      console.log(`Stored order ${order.id} in Firebase`);

    } catch (error) {
      console.error(`Error storing order ${order.id}:`, error);
      throw error;
    }
  }

  async syncOrdersToFirebase(): Promise<{ synced: number, errors: number }> {
    console.log('Starting order sync to Firebase...');
    try {
      const orders = await this.getOpenOrders(50);
      console.log(`Fetched ${orders.length} orders from Shopify`);

      const ordersCollection = collection(this.db, 'shopify-orders');
      let syncedCount = 0;
      let errorCount = 0;

      for (const order of orders) {
        try {
          // Check if order already exists
          const q = query(ordersCollection, where('id', '==', order.id));
          const existingDocs = await getDocs(q);

          if (existingDocs.empty) {
            // Add new order
            await addDoc(ordersCollection, {
              ...order,
              syncedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
            });
            console.log(`Synced order ${order.id} to Firebase`);
            syncedCount++;
          } else {
            console.log(`Order ${order.id} already exists, skipping`);
          }
        } catch (error) {
          console.error(`Error syncing order ${order.id}:`, error);
          errorCount++;
        }
      }

      console.log(`Sync completed. Synced: ${syncedCount}, Errors: ${errorCount}`);
      return { synced: syncedCount, errors: errorCount };
    } catch (error) {
      console.error('Error in syncOrdersToFirebase:', error);
      throw error;
    }
  }

  async startFullOrderSync(): Promise<{ message: string, jobId: string }> {
    console.log('Starting full order sync job...');
    
    // Create a sync job record
    const jobId = `sync_${Date.now()}`;
    const syncJobsCollection = collection(this.db, 'sync-jobs');
    await addDoc(syncJobsCollection, {
      id: jobId,
      type: 'full-order-sync',
      status: 'started',
      startedAt: new Date().toISOString(),
      totalOrders: 0,
      syncedOrders: 0,
      errors: 0
    });

    // Start the sync process in the background
    this.runFullOrderSync(jobId).catch(error => {
      console.error('Background sync failed:', error);
    });

    return {
      message: 'Order sync job started',
      jobId
    };
  }

  private async runFullOrderSync(jobId: string): Promise<void> {
    console.log(`Running full order sync job ${jobId}...`);
    let hasNextPage = true;
    let cursor = null;
    let totalProcessed = 0;
    let processedIds = new Set<string>();

    try {
      while (hasNextPage) {
        console.log(`Fetching batch of orders${cursor ? ` after ${cursor}` : ''}...`);
        
        const data: OrdersResponse = await this.client.request<OrdersResponse>(
          this.GET_ALL_ORDERS_QUERY,
          { cursor }
        );

        if (!data?.orders?.edges?.length) {
          hasNextPage = false;
          continue;
        }

        const batch = writeBatch(this.db);
        const orders = data.orders.edges;

        console.log(`Processing ${orders.length} new orders...`);

        for (const edge of orders) {
          const order = edge.node;
          if (!processedIds.has(order.id)) {
            processedIds.add(order.id);
            const orderRef = doc(collection(this.db, 'shopify-orders'));
            batch.set(orderRef, {
              ...order,
              syncedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
            });
            console.log(`Added new order ${order.id} to batch`);
            totalProcessed++;
          }
        }

        if (processedIds.size > 0) {
          await batch.commit();
          console.log(`Committed batch of ${processedIds.size} new orders`);
        }

        // Update cursor for next batch
        hasNextPage = data.orders.pageInfo.hasNextPage;
        cursor = data.orders.pageInfo.endCursor;

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`Sync completed. Total new orders processed: ${totalProcessed}`);

    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }
} 