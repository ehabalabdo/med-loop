import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  await sql`UPDATE clinics SET category = 'department' WHERE id = 1`;
  console.log('Done: MedLoop Main Branch category changed to department');
  
  const result = await sql`SELECT id, name, category FROM clinics ORDER BY id`;
  console.log('Current clinics:', JSON.stringify(result, null, 2));
}

main().catch(e => console.error(e));
