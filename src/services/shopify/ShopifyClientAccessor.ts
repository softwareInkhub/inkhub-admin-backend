import { GraphQLClient } from 'graphql-request';

export class ShopifyClientAccessor {
  private client: GraphQLClient;
  private static instance: ShopifyClientAccessor;

  private constructor() {
    const storeUrl = process.env.SHOPIFY_STORE_URL;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!storeUrl || !accessToken) {
      throw new Error('Missing Shopify credentials');
    }

    this.client = new GraphQLClient(`${storeUrl}/admin/api/2024-01/graphql.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
  }

  public static getInstance(): ShopifyClientAccessor {
    if (!ShopifyClientAccessor.instance) {
      ShopifyClientAccessor.instance = new ShopifyClientAccessor();
    }
    return ShopifyClientAccessor.instance;
  }

  public getClient(): GraphQLClient {
    return this.client;
  }
} 