const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
// import { PaymentMethod, OrderData, CreateOrderResponse } from '@//types/woocommerce';
     type CartItem ={
  product_id: number;
  quantity: number;
  variation_id?: number;
  price?: number;
  name?: string;
}

 interface ShippingAddress {
  id?: string;
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
  is_default?: boolean;
  label?: string; // Custom label like "Home", "Work", etc.
}

type PaymentMethod ={
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  method_title?: string;
  method_description?: string;
}

interface OrderData {
  payment_method: string;
  payment_method_title: string;
  set_paid: boolean;
  billing:ShippingAddress;
  shipping:ShippingAddress;
  line_items: CartItem[];
  shipping_lines: Array<{
    method_id: string;
    method_title: string;
    total: string;
  }>;
}

interface CreateOrderResponse {
  id: number;
  order_key: string;
  number: string;
  status: string;
  currency: string;
  total: string;
  payment_url?: string;
    date_created: string;
  date_modified: string;
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
        payment_url: response.data.payment_url,
        date_created: response.data.date_created,
        date_modified: response.data.date_modified
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