export interface ShopifyProduct {
  id: string;
  title: string;
  description?: string;
  handle?: string;
  status: string;
  variants: {
    edges: Array<{
      node: ShopifyVariant;
    }>;
  };
  images: {
    edges: Array<{
      node: ShopifyImage;
    }>;
  };
}

export interface ShopifyVariant {
  id: string;
  title: string;
  price: string;
  sku?: string;
  inventoryQuantity?: number;
}

export interface ShopifyOrder {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
  customer?: ShopifyCustomer;
  totalPriceSet?: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    }
  };
  displayFulfillmentStatus?: string;
  displayFinancialStatus?: string;
  lineItems: {
    edges: Array<{
      node: ShopifyLineItem;
    }>;
  };
}

export interface ShopifyCustomer {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
  products: {
    edges: Array<{
      node: ShopifyProduct;
    }>;
  };
}

interface ShopifyImage {
  id: string;
  url: string;
  altText?: string;
}

interface ShopifyLineItem {
  id: string;
  title: string;
  quantity: number;
  variant?: ShopifyVariant;
}

export interface ProcessedShopifyOrder {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
  customer?: ShopifyCustomer;
  totalPriceSet?: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    }
  };
  displayFulfillmentStatus?: string;
  displayFinancialStatus?: string;
  lineItems: Array<{
    title: string;
    quantity: number;
    variant?: ShopifyVariant;
  }>;
} 