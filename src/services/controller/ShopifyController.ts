import { NextApiResponse } from 'next';
import { ShopifyClientAccessor } from '@/services/clientaccessor/ShopifyClientAccessor';
import { collection, addDoc, query, where, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { FirebaseClientAccessor } from '@/services/clientaccessor/FirebaseClientAccessor';
import { FETCH_PRODUCTS, FETCH_ORDERS, FETCH_COLLECTIONS, FETCH_OPEN_ORDERS } from '@/services/graphql/ShopifyQueries';
import { ShopifyProduct, ShopifyOrder, ShopifyCollection, ProcessedShopifyOrder } from '@/services/types/ShopifyTypes';
import { ShopifyBuilder } from '@/services/builder/ShopifyBuilder';

interface ShopifyResponse<T> {
  products?: { edges: Array<{ node: T }> };
  orders?: { edges: Array<{ node: T }> };
  collections?: { edges: Array<{ node: T }> };
  pageInfo?: { hasNextPage: boolean; endCursor: string };
}

export class ShopifyController {
  private client = ShopifyClientAccessor.getInstance().getClient();
  private db = FirebaseClientAccessor.getInstance().getDb();
  private processedIds = new Set<string>();
  private batchSize = 50;

  async getProducts(limit: number, res: NextApiResponse) {
    try {
      const response = await this.client.request<ShopifyResponse<ShopifyProduct>>(FETCH_PRODUCTS, { first: limit });
      const products = response.products?.edges.map(edge => ShopifyBuilder.buildProduct(edge.node)) || [];
      return res.status(200).json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  async getOrders(limit: number, res: NextApiResponse) {
    try {
      const response = await this.client.request<ShopifyResponse<ShopifyOrder>>(FETCH_ORDERS, { first: limit });
      const orders = response.orders?.edges.map(edge => ShopifyBuilder.buildOrder(edge.node)) || [];
      return res.status(200).json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  async getCollections(limit: number, res: NextApiResponse) {
    try {
      const response = await this.client.request<ShopifyResponse<ShopifyCollection>>(FETCH_COLLECTIONS, { first: limit });
      const collections = response.collections?.edges.map(edge => edge.node) || [];
      return res.status(200).json(collections);
    } catch (error) {
      console.error('Error fetching collections:', error);
      throw error;
    }
  }

  async getOpenOrders(limit: number, res: NextApiResponse) {
    try {
      const response = await this.client.request<ShopifyResponse<ShopifyOrder>>(FETCH_OPEN_ORDERS, { first: limit });
      const orders = response.orders?.edges.map(edge => ShopifyBuilder.buildProcessedOrder(edge.node)) || [];
      return res.status(200).json({
        success: true,
        count: orders.length,
        orders
      });
    } catch (error) {
      console.error('Error fetching open orders:', error);
      throw error;
    }
  }

  async syncOrdersToFirebase(res: NextApiResponse) {
    try {
      console.log('Starting syncOrdersToFirebase...');
      const response = await this.client.request<ShopifyResponse<ShopifyOrder>>(FETCH_OPEN_ORDERS, { first: 50 });
      console.log('Fetched orders from Shopify:', {
        hasOrders: !!response.orders,
        edgesCount: response.orders?.edges?.length
      });

      const processedOrders = response.orders?.edges.map(edge => ShopifyBuilder.buildOrder(edge.node)) || [];
      console.log(`Processing ${processedOrders.length} orders`);
      
      let syncedCount = 0;
      let errorCount = 0;

      for (const order of processedOrders) {
        try {
          console.log('\nProcessing order:', {
            id: order.id,
            name: order.name,
            hasEmail: !!order.email,
            hasCustomer: !!order.customer,
            lineItemsCount: order.lineItems?.edges?.length
          });

          const ordersCollection = collection(this.db, 'shopify-orders');
          const q = query(ordersCollection, where('id', '==', order.id));
          const existingDocs = await getDocs(q);

          if (existingDocs.empty) {
            const orderData = {
              id: order.id,
              name: order.name || '',
              email: order.email || '',
              createdAt: order.createdAt,
              customer: {
                id: order.customer?.id || '',
                email: order.customer?.email || '',
                firstName: order.customer?.firstName || '',
                lastName: order.customer?.lastName || ''
              },
              totalPriceSet: order.totalPriceSet || { shopMoney: { amount: '0', currencyCode: 'USD' } },
              displayFulfillmentStatus: order.displayFulfillmentStatus || 'UNFULFILLED',
              displayFinancialStatus: order.displayFinancialStatus || 'PENDING',
              lineItems: {
                edges: (order.lineItems?.edges || []).map(edge => ({
                  node: {
                    id: edge.node.id || '',
                    title: edge.node.title || '',
                    quantity: edge.node.quantity || 0,
                    variant: edge.node.variant || null
                  }
                }))
              },
              syncedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
            };

            console.log('Prepared order data:', {
              id: orderData.id,
              hasEmail: !!orderData.email,
              hasCustomer: !!orderData.customer,
              customerFields: {
                hasId: !!orderData.customer.id,
                hasEmail: !!orderData.customer.email,
                hasFirstName: !!orderData.customer.firstName,
                hasLastName: !!orderData.customer.lastName
              },
              hasTotalPriceSet: !!orderData.totalPriceSet,
              lineItemsCount: orderData.lineItems.edges.length
            });

            try {
              await addDoc(ordersCollection, orderData);
              console.log(`Successfully saved order ${order.id}`);
              syncedCount++;
            } catch (saveError: unknown) {
              if (saveError instanceof Error) {
                console.error('Error saving order to Firebase:', {
                  orderId: order.id,
                  errorMessage: saveError.message,
                  errorCode: (saveError as any).code,
                  invalidFields: saveError.message.match(/field value: undefined \(found in field (.*?)\)/)?.[1]
                });
              }
              errorCount++;
            }
          } else {
            console.log(`Order ${order.id} already exists, skipping`);
          }
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error(`Error processing order ${order.id}:`, {
              errorMessage: error.message,
              errorCode: (error as any).code
            });
          }
          errorCount++;
        }
      }

      console.log('Sync completed:', {
        totalProcessed: processedOrders.length,
        syncedCount,
        errorCount
      });

      return res.status(200).json({
        success: true,
        message: 'Orders synced successfully',
        synced: syncedCount,
        errors: errorCount
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error in syncOrdersToFirebase:', {
          errorMessage: error.message,
          errorCode: (error as any).code,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  async startFullOrderSync(res: NextApiResponse) {
    const jobId = `sync_${Date.now()}`;
    
    try {
      console.log('Starting full order sync job:', { jobId });
      const syncJobsCollection = collection(this.db, 'sync-jobs');
      
      const jobData = {
        id: jobId,
        type: 'full-order-sync',
        status: 'started',
        startedAt: new Date().toISOString()
      };
      
      console.log('Creating sync job record:', jobData);
      await addDoc(syncJobsCollection, jobData);
      console.log('Sync job record created successfully');

      // Start background sync
      console.log('Initiating background sync process...');
      this.runFullOrderSync(jobId).catch(error => {
        console.error('Background sync failed:', {
          jobId,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined
        });
      });

      console.log('Sync job initiated successfully');
      return res.status(200).json({
        success: true,
        message: 'Order sync job started',
        jobId
      });
    } catch (error) {
      console.error('Error starting full order sync:', {
        jobId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (error instanceof Error && (error as any).code === 'deadline-exceeded') {
          console.log(`Operation timed out, attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  private async getExistingOrder(orderId: string): Promise<boolean> {
    return await this.retryOperation(async () => {
      const ordersCollection = collection(this.db, 'shopify-orders');
      const q = query(ordersCollection, where('id', '==', orderId));
      const existingDocs = await getDocs(q);
      return !existingDocs.empty;
    });
  }

  private async commitBatchWithRetry(batch: any, batchSize: number): Promise<void> {
    await this.retryOperation(async () => {
      console.log(`Attempting to commit batch of ${batchSize} orders to Firebase`);
      await batch.commit();
      console.log('Batch committed successfully');
    });
  }

  private async updateSyncJobStatus(
    jobId: string,
    updateData: any
  ): Promise<void> {
    await this.retryOperation(async () => {
      const syncJobsCollection = collection(this.db, 'sync-jobs');
      const q = query(syncJobsCollection, where('id', '==', jobId));
      const jobDocs = await getDocs(q);
      
      if (!jobDocs.empty) {
        const jobDoc = jobDocs.docs[0];
        console.log('Updating job status:', updateData);
        await updateDoc(jobDoc.ref, updateData);
      }
    });
  }

  private async runFullOrderSync(jobId: string) {
    let hasNextPage = true;
    let cursor: string | null = null;
    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let batchNumber = 0;
    const MAX_BATCH_SIZE = 100;

    console.log('Starting runFullOrderSync:', { jobId });

    try {
      while (hasNextPage) {
        batchNumber++;
        console.log(`Processing batch #${batchNumber}:`, {
          jobId,
          cursor,
          totalProcessed,
          totalSkipped,
          totalErrors
        });

        const response: ShopifyResponse<ShopifyOrder> = await this.client.request<ShopifyResponse<ShopifyOrder>>(
          FETCH_ORDERS, 
          { first: this.batchSize, after: cursor }
        );
        
        if (!response.orders?.edges) {
          console.log('No orders found in response, breaking loop');
          break;
        }
        
        const orders = response.orders.edges;
        console.log(`Retrieved ${orders.length} orders from Shopify`);
        
        let batch = writeBatch(this.db);
        let batchSize = 0;

        for (const edge of orders) {
          const order = ShopifyBuilder.buildOrder(edge.node);
          try {
            console.log(`Processing order: ${order.id}`);
            
            const exists = await this.getExistingOrder(order.id);
            
            if (!exists && !this.processedIds.has(order.id)) {
              this.processedIds.add(order.id);
              const orderRef = doc(collection(this.db, 'shopify-orders'));
              
              batch.set(orderRef, {
                ...order,
                syncedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
              });
              
              batchSize++;
              totalProcessed++;
              console.log(`Order ${order.id} added to batch`);

              // Commit batch if it reaches max size
              if (batchSize >= MAX_BATCH_SIZE) {
                await this.commitBatchWithRetry(batch, batchSize);
                batch = writeBatch(this.db);
                batchSize = 0;
              }
            } else {
              totalSkipped++;
              console.log(`Order ${order.id} skipped - already exists`);
            }
          } catch (error: unknown) {
            if (error instanceof Error) {
              console.error(`Error processing order ${order.id}:`, {
                errorMessage: error.message,
                errorCode: (error as any).code,
                stack: error.stack
              });
            }
            totalErrors++;
          }
        }

        // Commit any remaining orders in the batch
        if (batchSize > 0) {
          await this.commitBatchWithRetry(batch, batchSize);
        }

        // Update sync job status
        const updateData = {
          totalOrders: totalProcessed + totalSkipped,
          syncedOrders: totalProcessed,
          skippedOrders: totalSkipped,
          errors: totalErrors,
          lastUpdated: new Date().toISOString()
        };
        
        await this.updateSyncJobStatus(jobId, updateData);

        hasNextPage = response.pageInfo?.hasNextPage || false;
        cursor = response.pageInfo?.endCursor || null;
        console.log('Batch complete:', {
          hasNextPage,
          cursor,
          totalProcessed,
          totalSkipped,
          totalErrors
        });

        // Add delay between batches to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Update final job status
      console.log('Sync process complete, updating final job status');
      const finalStatus = {
        status: 'completed',
        completedAt: new Date().toISOString(),
        totalOrders: totalProcessed + totalSkipped,
        syncedOrders: totalProcessed,
        skippedOrders: totalSkipped,
        errors: totalErrors
      };
      
      await this.updateSyncJobStatus(jobId, finalStatus);

      console.log('Full order sync completed successfully:', {
        jobId,
        totalProcessed,
        totalSkipped,
        totalErrors
      });
    } catch (error) {
      console.error('Sync failed:', {
        jobId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
      
      // Update job status with error
      await this.updateSyncJobStatus(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date().toISOString(),
        totalOrders: totalProcessed + totalSkipped,
        syncedOrders: totalProcessed,
        skippedOrders: totalSkipped,
        errors: totalErrors
      });
      
      throw error;
    }
  }
} 