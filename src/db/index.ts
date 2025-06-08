import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { DB } from "../types/db";
import dotenv from "dotenv";

dotenv.config();

let poolInstance: Pool;

const createPool = () => {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 10000,
  });
};

const getPoolInstance = () => {
  if (!poolInstance) {
    poolInstance = createPool();
  }
  return poolInstance;
};

const dialect = new PostgresDialect({
  pool: async () => getPoolInstance(),
});

export function getSQLClient() {
  return new Kysely<DB>({
    dialect,
  });
}
