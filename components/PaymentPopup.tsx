"use client";

import React, { useState, useEffect } from 'react';
// import { PaymentMethod, CartItem, ShippingAddress, PaymentTiming, SavedAddresses } from '@/types/woocommerce';

 interface PaymentMethod {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  method_title?: string;
  method_description?: string;
}
 interface CartItem {
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

 interface SavedAddresses {
  addresses: ShippingAddress[];
  defaultAddressId?: string;
}

interface OrderData {
  payment_method: string;
  payment_method_title: string;
  set_paid: boolean;
  billing: ShippingAddress;
  shipping: ShippingAddress;
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

export interface PaymentTiming {
  method: string;
  estimated_processing: string;
  description: string;
}



interface PaymentPopupProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  totalAmount: number;
  customerInfo: {
    email: string;
    firstName: string;
    lastName: string;
  };
  onPaymentSuccess?: (orderData: any) => void;
}

const PaymentPopup: React.FC<PaymentPopupProps> = ({
  isOpen,
  onClose,
  cartItems,
  totalAmount,
  customerInfo,
  onPaymentSuccess
}) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [activeStep, setActiveStep] = useState<'address' | 'payment'>('address');
  const [showAddressForm, setShowAddressForm] = useState<boolean>(false);
  const [savedAddresses, setSavedAddresses] = useState<ShippingAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [saveNewAddress, setSaveNewAddress] = useState<boolean>(true);
  const [addressLabel, setAddressLabel] = useState<string>('');
  
  // Shipping address state
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    first_name: customerInfo.firstName,
    last_name: customerInfo.lastName,
    address_1: '',
    address_2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'US',
    email: customerInfo.email,
    phone: ''
  });

  // Payment timing information
  const paymentTiming: Record<string, PaymentTiming> = {
    bacs: {
      method: 'Bank Transfer',
      estimated_processing: '2-3 business days',
      description: 'Orders are processed once payment is confirmed by the bank'
    },
    cheque: {
      method: 'Check Payment',
      estimated_processing: '5-7 business days',
      description: 'Order will be processed after we receive and clear your check'
    },
    cod: {
      method: 'Cash on Delivery',
      estimated_processing: '1-2 business days',
      description: 'Pay with cash when your order is delivered'
    },
    paypal: {
      method: 'PayPal',
      estimated_processing: 'Instant',
      description: 'Your order will be processed immediately after payment confirmation'
    },
    stripe: {
      method: 'Credit Card',
      estimated_processing: 'Instant',
      description: 'Your order will be processed immediately after payment confirmation'
    }
  };

  // Load saved addresses from localStorage
  useEffect(() => {
    if (isOpen) {
      loadSavedAddresses();
      fetchPaymentMethods();
      setActiveStep('address');
      setShippingAddress(prev => ({
        ...prev,
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        email: customerInfo.email
      }));
    }
  }, [isOpen]);

  const loadSavedAddresses = () => {
    try {
      const saved = localStorage.getItem('woocommerce_saved_addresses');
      if (saved) {
        const parsed: SavedAddresses = JSON.parse(saved);
        setSavedAddresses(parsed.addresses || []);
        
        // Select the default address if available
        if (parsed.defaultAddressId) {
          const defaultAddress = parsed.addresses.find(addr => addr.id === parsed.defaultAddressId);
          if (defaultAddress) {
            setSelectedAddressId(defaultAddress.id!);
            setShippingAddress(defaultAddress);
          }
        } else if (parsed.addresses.length > 0) {
          // Select first address if no default
          setSelectedAddressId(parsed.addresses[0].id!);
          setShippingAddress(parsed.addresses[0]);
        }
      }
    } catch (error) {
      console.error('Error loading saved addresses:', error);
    }
  };

  const saveAddressesToStorage = (addresses: ShippingAddress[], defaultAddressId?: string) => {
    try {
      const data: SavedAddresses = {
        addresses,
        defaultAddressId
      };
      localStorage.setItem('woocommerce_saved_addresses', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving addresses:', error);
    }
  };

  const handleSaveAddress = () => {
    if (!shippingAddress.address_1.trim() || !shippingAddress.city.trim() || 
        !shippingAddress.state.trim() || !shippingAddress.postcode.trim()) {
      setError('Please fill in all required address fields');
      return;
    }

    const newAddress: ShippingAddress = {
      ...shippingAddress,
      id: Date.now().toString(),
      label: addressLabel || `${shippingAddress.address_1.substring(0, 15)}...`
    };

    const updatedAddresses = [...savedAddresses, newAddress];
    setSavedAddresses(updatedAddresses);
    
    // If this is the first address, set it as default
    const newDefaultAddressId = savedAddresses.length === 0 ? newAddress.id : undefined;
    
    saveAddressesToStorage(updatedAddresses, newDefaultAddressId);
    setSelectedAddressId(newAddress.id!);
    setShowAddressForm(false);
    setAddressLabel('');
    setError('');
  };

  const handleSelectAddress = (addressId: string) => {
    const address = savedAddresses.find(addr => addr.id === addressId);
    if (address) {
      setSelectedAddressId(addressId);
      setShippingAddress(address);
    }
  };

  const handleDeleteAddress = (addressId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedAddresses = savedAddresses.filter(addr => addr.id !== addressId);
    setSavedAddresses(updatedAddresses);
    
    if (selectedAddressId === addressId) {
      // Select another address if available
      if (updatedAddresses.length > 0) {
        setSelectedAddressId(updatedAddresses[0].id!);
        setShippingAddress(updatedAddresses[0]);
      } else {
        setSelectedAddressId('');
        setShippingAddress({
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          address_1: '',
          address_2: '',
          city: '',
          state: '',
          postcode: '',
          country: 'US',
          email: customerInfo.email,
          phone: ''
        });
      }
    }
    
    saveAddressesToStorage(updatedAddresses);
  };

  const handleSetDefaultAddress = (addressId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    saveAddressesToStorage(savedAddresses, addressId);
    setError('Default address updated!');
    setTimeout(() => setError(''), 2000);
  };

  const fetchPaymentMethods = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/payment-methods');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load payment methods');
      }

      setPaymentMethods(result.data);
      
      if (result.data.length > 0) {
        setSelectedMethod(result.data[0].id);
      } else {
        setError('No payment methods available');
      }
      
    } catch (err: any) {
      console.error('Error fetching payment methods:', err);
      setError(err.message || 'Failed to load payment methods');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!shippingAddress.address_1.trim() || !shippingAddress.city.trim() || 
        !shippingAddress.state.trim() || !shippingAddress.postcode.trim()) {
      setError('Please fill in all required address fields');
      return;
    }

    // Save address if checkbox is checked and it's a new address
    if (saveNewAddress && !savedAddresses.find(addr => 
      addr.address_1 === shippingAddress.address_1 && 
      addr.postcode === shippingAddress.postcode)) {
      const newAddress: ShippingAddress = {
        ...shippingAddress,
        id: Date.now().toString(),
        label: `Address ${savedAddresses.length + 1}`
      };
      const updatedAddresses = [...savedAddresses, newAddress];
      setSavedAddresses(updatedAddresses);
      saveAddressesToStorage(updatedAddresses);
    }

    setActiveStep('payment');
    setError('');
  };

  const handleAddressChange = (field: keyof ShippingAddress, value: string) => {
    setShippingAddress(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePayment = async () => {
    if (!selectedMethod) {
      setError('Please select a payment method');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const selectedPayment = paymentMethods.find(m => m.id === selectedMethod);
      
      const orderData = {
        payment_method: selectedMethod,
        payment_method_title: selectedPayment?.title || selectedMethod,
        set_paid: false,
        status: 'pending',
        billing: {
          ...shippingAddress,
          email: customerInfo.email
        },
        shipping: shippingAddress,
        line_items: cartItems,
        shipping_lines: [
          {
            method_id: 'flat_rate',
            method_title: 'Standard Shipping',
            total: '0.00'
          }
        ]
      };

      const response = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Payment failed');
      }

      // Payment successful
      if (onPaymentSuccess) {
        onPaymentSuccess(result.data);
      }

      const timing = paymentTiming[selectedMethod] || paymentTiming.bacs;
      
      alert(`Payment Successful!\n\nOrder #${result.data.number}\nTotal: $${totalAmount}\nPayment Method: ${selectedPayment?.title}\nEstimated Processing: ${timing.estimated_processing}\n\n${timing.description}`);
      onClose();
      
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getPaymentTimingInfo = () => {
    if (!selectedMethod) return null;
    
    const timing = paymentTiming[selectedMethod] || paymentTiming.bacs;
    return timing;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Complete Your Order</h2>
            <p className="text-sm text-gray-600 mt-1">Total: ${totalAmount.toFixed(2)}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 pt-6">
          <div className="flex items-center justify-center mb-8">
            <div className={`flex items-center ${activeStep === 'address' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mr-2 ${
                activeStep === 'address' ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
              }`}>
                1
              </div>
              <span className="font-medium">Shipping Address</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300 mx-4"></div>
            <div className={`flex items-center ${activeStep === 'payment' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mr-2 ${
                activeStep === 'payment' ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
              }`}>
                2
              </div>
              <span className="font-medium">Payment</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Step 1: Shipping Address */}
          {activeStep === 'address' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipping Address</h3>
                
                {/* Saved Addresses */}
                {savedAddresses.length > 0 && !showAddressForm && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Select Saved Address
                    </label>
                    <div className="space-y-3">
                      {savedAddresses.map((address) => (
                        <div
                          key={address.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${
                            selectedAddressId === address.id
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-20'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleSelectAddress(address.id!)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center mb-1">
                                <h4 className="font-medium text-gray-900">{address.label}</h4>
                                {address.is_default && (
                                  <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">
                                {address.first_name} {address.last_name}<br />
                                {address.address_1}<br />
                                {address.address_2 && <>{address.address_2}<br /></>}
                                {address.city}, {address.state} {address.postcode}<br />
                                {address.phone && `Phone: ${address.phone}`}
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={(e) => handleSetDefaultAddress(address.id!, e)}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                                title="Set as default"
                              >
                                ⭐
                              </button>
                              <button
                                onClick={(e) => handleDeleteAddress(address.id!, e)}
                                className="text-red-600 hover:text-red-800 text-sm"
                                title="Delete address"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => setShowAddressForm(true)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        + Add New Address
                      </button>
                    </div>
                  </div>
                )}

                {/* Address Form - Show when no saved addresses or when adding new */}
                {(savedAddresses.length === 0 || showAddressForm) && (
                  <form onSubmit={handleAddressSubmit} className="space-y-4">
                    {savedAddresses.length > 0 && (
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-medium text-gray-900">Add New Address</h4>
                        <button
                          type="button"
                          onClick={() => setShowAddressForm(false)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          First Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingAddress.first_name}
                          onChange={(e) => handleAddressChange('first_name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingAddress.last_name}
                          onChange={(e) => handleAddressChange('last_name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={shippingAddress.email}
                        onChange={(e) => handleAddressChange('email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={shippingAddress.phone}
                        onChange={(e) => handleAddressChange('phone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        required
                        value={shippingAddress.address_1}
                        onChange={(e) => handleAddressChange('address_1', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="123 Main St"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Apartment, Suite, etc. (Optional)
                      </label>
                      <input
                        type="text"
                        value={shippingAddress.address_2}
                        onChange={(e) => handleAddressChange('address_2', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          City *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingAddress.city}
                          onChange={(e) => handleAddressChange('city', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          State *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingAddress.state}
                          onChange={(e) => handleAddressChange('state', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ZIP Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingAddress.postcode}
                          onChange={(e) => handleAddressChange('postcode', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Address Label for New Address */}
                    {showAddressForm && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address Label (e.g., Home, Work)
                        </label>
                        <input
                          type="text"
                          value={addressLabel}
                          onChange={(e) => setAddressLabel(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Home"
                        />
                      </div>
                    )}

                    {/* Save Address Checkbox */}
                    {!showAddressForm && (
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="saveAddress"
                          checked={saveNewAddress}
                          onChange={(e) => setSaveNewAddress(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="saveAddress" className="ml-2 block text-sm text-gray-700">
                          Save this address for future orders
                        </label>
                      </div>
                    )}

                    <div className="flex justify-between pt-4">
                      {savedAddresses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowAddressForm(false)}
                          className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                        >
                          Back to Saved Addresses
                        </button>
                      )}
                      
                      <div className="flex space-x-3 ml-auto">
                        {showAddressForm ? (
                          <button
                            type="button"
                            onClick={handleSaveAddress}
                            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                          >
                            Save Address
                          </button>
                        ) : (
                          <button
                            type="submit"
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                          >
                            Continue to Payment
                          </button>
                        )}
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Payment Method */}
          {activeStep === 'payment' && (
            <div className="space-y-6">
              {/* Shipping Address Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Shipping To:</h4>
                    <p className="text-sm text-gray-600">
                      {shippingAddress.first_name} {shippingAddress.last_name}<br />
                      {shippingAddress.address_1}<br />
                      {shippingAddress.address_2 && <>{shippingAddress.address_2}<br /></>}
                      {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postcode}<br />
                      {shippingAddress.phone && `Phone: ${shippingAddress.phone}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveStep('address')}
                    className="text-blue-600 text-sm hover:text-blue-700"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Payment Method</h3>
                
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 mt-2">Loading payment methods...</p>
                  </div>
                ) : paymentMethods.length > 0 ? (
                  <div className="space-y-4">
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          selectedMethod === method.id
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-20'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedMethod(method.id)}
                      >
                        <div className="flex items-start">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 mt-0.5 ${
                            selectedMethod === method.id
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300'
                          }`}>
                            {selectedMethod === method.id && (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <h4 className="font-medium text-gray-900">{method.title}</h4>
                            </div>
                            {method.description && (
                              <p className="text-sm text-gray-500 mt-1">{method.description}</p>
                            )}
                            
                            {/* Payment Timing Information */}
                            {selectedMethod === method.id && getPaymentTimingInfo() && (
                              <div className="mt-3 p-3 bg-white rounded border">
                                <div className="flex items-center text-sm">
                                  <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="font-medium text-gray-700">
                                    Estimated Processing: {getPaymentTimingInfo()?.estimated_processing}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 mt-1 ml-6">
                                  {getPaymentTimingInfo()?.description}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No payment methods available
                  </div>
                )}
              </div>

              {/* Order Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Order Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping:</span>
                    <span>$0.00</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total:</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setActiveStep('address')}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handlePayment}
                  disabled={isProcessing || !selectedMethod || isLoading}
                  className="flex-1 px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    `Pay $${totalAmount.toFixed(2)}`
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentPopup;