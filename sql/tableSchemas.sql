
CREATE TABLE vendors (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  stock_endpoint_url TEXT
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  total_stock INTEGER NOT NULL,
  vendor_id TEXT NOT NULL,
  last_synced_at TIMESTAMP
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);
