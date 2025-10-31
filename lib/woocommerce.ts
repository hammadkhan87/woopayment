const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
import { PaymentMethod, OrderData, CreateOrderResponse } from '@//types/woocommerce';
    
type PaymentMethod ={
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  method_title?: string;
  method_description?: string;
}


class WooCommerceService {
  private api: any;

  constructor() {
    const storeUrl = process.env.WOOCOMMERCE_STORE_URL;
    const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
    const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;

    // Validate environment variables
    if (!storeUrl || !consumerKey || !consumerSecret) {
      throw new Error('Missing WooCommerce environment variables');
    }

    this.api = new WooCommerceRestApi({
      url: storeUrl,
      consumerKey: consumerKey,
      consumerSecret: consumerSecret,
      version: 'wc/v3',
      queryStringAuth: true,
      axiosConfig: {
        // For development - remove in production
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      }
    });
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      console.log('🔄 Fetching payment methods from WooCommerce...');
      
      const response = await this.api.get('payment_gateways');
      const enabledMethods = response.data.filter((method: any) => method.enabled);
      
      console.log(`✅ Found ${enabledMethods.length} enabled payment methods`);
      
      return enabledMethods.map((method: any) => ({
        id: method.id,
        title: method.title,
        description: method.description,
        enabled: method.enabled,
        method_title: method.method_title,
        method_description: method.method_description
      }));
      
    } catch (error: any) {
      console.error('❌ Error fetching payment methods:', error);
      throw this.handleError(error);
    }
  }

  async createOrder(orderData: Partial<OrderData>): Promise<CreateOrderResponse> {
    try {
      console.log('🔄 Creating order in WooCommerce...');
      
      const response = await this.api.post('orders', orderData);
      console.log('✅ Order created successfully:', response.data.id);
      
      return {
        id: response.data.id,
        order_key: response.data.order_key,
        number: response.data.number,
        status: response.data.status,
        currency: response.data.currency,
        total: response.data.total,
        payment_url: response.data.payment_url
      };
      
    } catch (error: any) {
      console.error('❌ Error creating order:', error);
      throw this.handleError(error);
    }
  }

  private handleError(error: any): Error {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 401:
          return new Error('Invalid WooCommerce API credentials');
        case 404:
          return new Error('WooCommerce store not found');
        case 403:
          return new Error('API access forbidden - check permissions');
        default:
          return new Error(data?.message || `WooCommerce API error: ${status}`);
      }
    } else if (error.request) {
      return new Error('Cannot connect to WooCommerce store');
    } else {
      return new Error(error.message || 'Unknown error occurred');
    }
  }
}

// Create singleton instance
export const wooCommerceService = new WooCommerceService();