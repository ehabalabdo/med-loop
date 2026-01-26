import { Pool } from 'pg';


const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_gOLQasZmU53k@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

export default pool;
