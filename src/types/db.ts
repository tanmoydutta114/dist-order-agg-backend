export interface Vendor {
  id: string;
  name: string;
  stock_endpoint_url: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Product {
  id: number; // Auto-increment primary key
  vendor_id: string;
  vendor_product_id: string; // The product ID from vendor's system
  name: string;
  stock_quantity: number;
  price: number;
  is_active: boolean;
  last_synced_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface AggregatedProduct {
  product_id: string; // vendor_product_id
  name: string;
  total_stock: number;
  vendor_count: number;
  last_synced_at: Date;
  available_vendors: string; // comma-separated vendor IDs
}

export interface Order {
  id: number;
  vendor_product_id: string; // References the logical product across vendors
  quantity: number;
  status: "pending" | "processing" | "success" | "failed" | "cancelled";
  customer_id?: string;
  total_amount?: number;
  created_at: Date;
  processed_at?: Date;
  failed_at?: Date;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number; // References specific vendor product
  quantity: number;
  reserved_quantity: number;
  price: number;
}

export interface StockReservation {
  id: number;
  order_id: number;
  product_id: number;
  reserved_quantity: number;
  status: "reserved" | "confirmed" | "released";
  expires_at?: Date;
  created_at: Date;
}

export interface DB {
  vendors: Vendor;
  products: Product;
  orders: Order;
  order_items: OrderItem;
  stock_reservations: StockReservation;
  aggregated_products: AggregatedProduct;
}
