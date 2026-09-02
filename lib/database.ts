import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

export type MaintenanceDatabase = NeonHttpDatabase<typeof schema>;

let database: MaintenanceDatabase | undefined;

export function databaseIsConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDatabase(): MaintenanceDatabase {
  if (database) {
    return database;
  }

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  database = drizzle(neon(connectionString), { schema });
  return database;
}

