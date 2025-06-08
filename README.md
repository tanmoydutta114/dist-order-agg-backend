# Distributed Order Aggregator System

This is a TypeScript-based backend system that aggregates stock from third-party vendors and processes high-volume orders using a local PostgreSQL DB and RabbitMQ queue.

## Tech Stack

- Node.js + TypeScript
- PostgreSQL (via Kysely)
- RabbitMQ
- Zod (validation)

---

## Features

- Sync vendor stock
- Place order via `/order` (REST API)
- Queue-based processing (RabbitMQ)
- Strong consistency via DB transactions

---

## Setup Instructions

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Database Setup**
   Just copy all the SQL from `tableSchemas.sql` and execute that — it should create all the tables.

3. **ENV file**

   ```bash
   DATABASE_URL=""
   ```

4. **RabbitMQ**
   Make sure RabbitMQ is installed.
   Run:

   ```bash
   npm run worker
   ```

   This will start the consumer process.

5. **Run Backend**
   Run:

   ```bash
   npm run start-dev
   ```

   This will start the backend server.

---

## API Endpoints

### Vendor Stock Sync

#### `GET /vendorSync`

Syncs all vendor stock into the local system by calling the registered vendor APIs.

---

### Product Operations

#### `GET /products`

Returns a list of all products currently available in the local stock database after synchronization.

---

### Order Operations

#### `POST /order` – Place Valid Order

Places an order if enough stock is available across local and vendor systems.

**Request Body Example**:

```json
{
  "products": [
    {
      "vendorProductId": "product-1",
      "quantity": 2
    },
    {
      "vendorProductId": "product-3",
      "quantity": 4
    },
    {
      "vendorProductId": "product-5",
      "quantity": 9
    }
  ],
  "customerId": "Custoemr Beta"
}
```

---

#### `POST /order` – Place Invalid Order (Insufficient Stock)

Attempts to place an order with quantity that exceeds the available stock, expected to return an error.

**Request Body Example**:

```json
{
  "products": [
    {
      "vendorProductId": "product-1",
      "quantity": 2000
    },
    {
      "vendorProductId": "product-3",
      "quantity": 4
    }
  ],
  "customerId": "Custoemr Beta"
}
```
