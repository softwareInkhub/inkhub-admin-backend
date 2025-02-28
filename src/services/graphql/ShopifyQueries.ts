export const FETCH_PRODUCTS = `
  query GetProducts($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          description
          handle
          status
          variants(first: 10) {
            edges {
              node {
                id
                title
                price
                sku
                inventoryQuantity
              }
            }
          }
          images(first: 5) {
            edges {
              node {
                id
                url
                altText
              }
            }
          }
        }
      }
    }
  }
`;

export const FETCH_ORDERS = `
  query GetOrders($first: Int!) {
    orders(first: $first) {
      edges {
        node {
          id
          name
          email
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          displayFulfillmentStatus
          displayFinancialStatus
          customer {
            id
            email
            firstName
            lastName
          }
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                variant {
                  id
                  title
                  price
                  sku
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const FETCH_COLLECTIONS = `
  query GetCollections($first: Int!) {
    collections(first: $first) {
      edges {
        node {
          id
          title
          handle
          products(first: 10) {
            edges {
              node {
                id
                title
                handle
              }
            }
          }
        }
      }
    }
  }
`;

export const FETCH_OPEN_ORDERS = `
  query GetOpenOrders($first: Int!) {
    orders(
      first: $first, 
      query: "fulfillment_status:unfulfilled OR fulfillment_status:in_progress",
      sortKey: CREATED_AT,
      reverse: true
    ) {
      edges {
        node {
          id
          name
          createdAt
          displayFulfillmentStatus
          displayFinancialStatus
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          customer {
            firstName
            lastName
            email
          }
          lineItems(first: 10) {
            edges {
              node {
                title
                quantity
                variant {
                  title
                  price
                }
              }
            }
          }
        }
      }
    }
  }
`; 