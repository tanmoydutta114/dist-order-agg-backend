export interface ProductValidation {
  vendorProductId: string;
  requestedQty: number;
  availableQty: number;
  canFulfill: boolean;
  cheapestPrice: number;
  vendorCount: number;
  bestVendorId: string;
}

export interface ProductInfo {
  id: number;
  vendor_id: string;
  vendor_product_id: string;
  stock_quantity: number;
  price: number;
  vendor_name: string;
}

export interface AllocationItem {
  productId: number;
  vendorId: string;
  vendorName: string; // Added for better logging
  quantity: number;
  price: number;
}

export interface AllocationResult {
  items: AllocationItem[];
  totalAllocated: number;
  totalCost: number;
}
