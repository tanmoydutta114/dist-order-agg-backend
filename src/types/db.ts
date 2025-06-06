export interface Product {
  id: string;
  name: string;
  total_stock: number;
  vendor_id: string;
  last_synced_at: Date;
}

export interface Order {
  id: string;
  product_id: string;
  quantity: number;
  status: "pending" | "success" | "failed";
  created_at: Date;
}

export interface Vendor {
  id: string;
  name: string;
  stock_endpoint_url: string;
}

export interface DB {
  products: Product;
  orders: Order;
  vendors: Vendor;
}
