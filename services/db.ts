import { neon } from '@neondatabase/serverless';

// Neon serverless SQL - works in browser via HTTP
// @ts-ignore - Vite env vars
const DATABASE_URL = import.meta.env.VITE_DATABASE_URL || 'postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

console.log('[DB] Neon connection initialized');

export default sql;
