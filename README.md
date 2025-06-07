# dist-order-agg-backend# Distributed Order Aggregator System

This is a TypeScript-based backend system that aggregates stock from third-party vendors and processes high-volume orders using a local PostgreSQL DB and RabbitMQ queue.

## Tech Stack

- Node.js + TypeScript
- PostgreSQL (via Kysely)
- RabbitMQ
- Zod (validation)

---

## Features

- Sync vendor stock (`scripts/sync-vendor-stock.ts`)
- Place order via `/order` (REST API)
- Queue-based processing (RabbitMQ)
- Strong consistency via DB transactions

---

## Setup Instructions

1. **Install dependencies**
   ```bash
   npm install
   ```
