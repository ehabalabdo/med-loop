import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require'
});

export default pool;
