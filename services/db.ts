import { neon } from '@neondatabase/serverless';

// Neon serverless SQL - works in browser via HTTP
const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require');

export default sql;
