import { ShopifyProduct, ShopifyOrder, ProcessedShopifyOrder } from '@/services/types/ShopifyTypes';

export class ShopifyBuilder {
  static buildProduct(data: any): ShopifyProduct {
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      handle: data.handle,
      status: data.status,
      variants: data.variants?.edges?.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        price: edge.node.price,
        sku: edge.node.sku,
        inventoryQuantity: edge.node.inventoryQuantity
      })) || [],
      images: data.images?.edges?.map((edge: any) => ({
        id: edge.node.id,
        url: edge.node.url,
        altText: edge.node.altText
      })) || []
    };
  }

  static buildOrder(data: any): ShopifyOrder {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      createdAt: data.createdAt,
      customer: {
        id: data.customer?.id || '',
        email: data.customer?.email || '',
        firstName: data.customer?.firstName || '',
        lastName: data.customer?.lastName || ''
      },
      totalPriceSet: data.totalPriceSet,
      displayFulfillmentStatus: data.displayFulfillmentStatus,
      displayFinancialStatus: data.displayFinancialStatus,
      lineItems: {
        edges: data.lineItems?.edges?.map((edge: any) => ({
          node: {
            id: edge.node.id,
            title: edge.node.title,
            quantity: edge.node.quantity,
            variant: edge.node.variant
          }
        })) || []
      }
    };
  }

  static buildProcessedOrder(data: any): ProcessedShopifyOrder {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      createdAt: data.createdAt,
      customer: {
        id: data.customer?.id || '',
        email: data.customer?.email || '',
        firstName: data.customer?.firstName || '',
        lastName: data.customer?.lastName || ''
      },
      totalPriceSet: data.totalPriceSet,
      displayFulfillmentStatus: data.displayFulfillmentStatus,
      displayFinancialStatus: data.displayFinancialStatus,
      lineItems: data.lineItems?.edges?.map((edge: any) => ({
        title: edge.node.title,
        quantity: edge.node.quantity,
        variant: edge.node.variant
      })) || []
    };
  }
} 