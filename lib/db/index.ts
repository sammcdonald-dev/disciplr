import { drizzle } from 'drizzle-orm/postgres-js';
//import { vector } from "drizzle-orm/pg-core";
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is not set');
}

const client = postgres(process.env.POSTGRES_URL);

export const db = drizzle(client, { schema });

// Export anything else you want
export * from './queries';
export * from './schema';
export * from './utils';
