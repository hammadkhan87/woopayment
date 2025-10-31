import { NextResponse } from 'next/server';
import { wooCommerceService } from '@/lib/woocommerce';

export async function GET() {
  try {
    const paymentMethods = await wooCommerceService.getPaymentMethods();
    
    return NextResponse.json({
      success: true,
      data: paymentMethods,
      count: paymentMethods.length
    });
    
  } catch (error: any) {
    console.error('❌ API Error:', error.message);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const orderData = await request.json();
    const order = await wooCommerceService.createOrder(orderData);
    
    return NextResponse.json({
      success: true,
      data: order,
      message: 'Order created successfully'
    });
    
  } catch (error: any) {
    console.error('❌ API Error creating order:', error.message);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}