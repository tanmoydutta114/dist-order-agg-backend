// ===============================
// DATABASE SCHEMA (SQL)
// ===============================

-- Create vendors table first
CREATE TABLE vendors (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  stock_endpoint_url VARCHAR(500) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table with composite key approach
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  vendor_id VARCHAR(50) NOT NULL,
  vendor_product_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Composite unique constraint to prevent duplicate vendor products
  UNIQUE(vendor_id, vendor_product_id),
  
  -- Foreign key to vendors
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  
  -- Indexes for performance
  INDEX idx_vendor_product (vendor_id, vendor_product_id),
  INDEX idx_stock_quantity (stock_quantity),
  INDEX idx_last_synced (last_synced_at)
);

-- Create aggregated_products view for unified inventory
CREATE VIEW aggregated_products AS
SELECT 
  vendor_product_id as product_id,
  name,
  SUM(stock_quantity) as total_stock,
  COUNT(vendor_id) as vendor_count,
  MAX(last_synced_at) as last_synced_at,
  STRING_AGG(vendor_id, ',') as available_vendors
FROM products 
WHERE is_active = true 
GROUP BY vendor_product_id, name;

-- Create orders table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  vendor_product_id VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled')),
  customer_id VARCHAR(100),
  total_amount DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  failed_at TIMESTAMP,
  
  -- Indexes
  INDEX idx_order_status (status),
  INDEX idx_order_created (created_at),
  INDEX idx_vendor_product_order (vendor_product_id)
);

-- Create order_items table for detailed tracking
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL, -- References products.id (specific vendor product)
  quantity INTEGER NOT NULL,
  reserved_quantity INTEGER DEFAULT 0,
  price DECIMAL(10,2),
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  
  INDEX idx_order_items_order (order_id),
  INDEX idx_order_items_product (product_id)
);

-- Create stock_reservations table for tracking vendor reservations
CREATE TABLE stock_reservations (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  reserved_quantity INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'released')),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  
  INDEX idx_reservations_order (order_id),
  INDEX idx_reservations_product (product_id),
  INDEX idx_reservations_expires (expires_at)
);

-- Insert sample vendors
INSERT INTO vendors (id, name, stock_endpoint_url) VALUES
('vendor-a', 'Vendor A Supply Co.', 'http://localhost:3000/vendorA/stock'),
('vendor-b', 'Vendor B Logistics', 'http://localhost:3000/vendorB/stock');