// src/db/index.ts
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { DB } from "../types/db";

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
});
