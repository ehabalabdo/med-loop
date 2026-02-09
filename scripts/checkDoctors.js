import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  const doctors = await sql`SELECT id, full_name, role, clinic_id, clinic_ids FROM users WHERE role = 'doctor' ORDER BY id`;
  console.log('Doctors in DB:', JSON.stringify(doctors, null, 2));
  
  const allUsers = await sql`SELECT id, full_name, role, clinic_ids FROM users ORDER BY id`;
  console.log('\nAll users:', JSON.stringify(allUsers, null, 2));
}

main().catch(e => console.error(e));
