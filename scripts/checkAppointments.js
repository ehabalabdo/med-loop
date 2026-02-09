import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  // Check table schema
  const cols = await sql`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'appointments' 
    ORDER BY ordinal_position
  `;
  console.log('Appointments table schema:');
  cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'} ${c.column_default || ''}`));

  // Check constraints
  const constraints = await sql`
    SELECT constraint_name, constraint_type 
    FROM information_schema.table_constraints 
    WHERE table_name = 'appointments'
  `;
  console.log('\nConstraints:', JSON.stringify(constraints, null, 2));

  // Check existing appointments
  const apps = await sql`SELECT * FROM appointments ORDER BY created_at DESC LIMIT 3`;
  console.log('\nRecent appointments:', JSON.stringify(apps, null, 2));

  // Try a test insert
  try {
    const testId = 'app_test_' + Date.now();
    await sql`
      INSERT INTO appointments (id, patient_id, patient_name, clinic_id, doctor_id, start_time, end_time, status, reason, created_at)
      VALUES (${testId}, '1', 'Test Patient', '2', null, NOW(), NOW() + interval '1 hour', 'scheduled', 'Test', NOW())
    `;
    console.log('\n✅ Test insert succeeded with id:', testId);
    // Clean up
    await sql`DELETE FROM appointments WHERE id = ${testId}`;
    console.log('✅ Test cleanup done');
  } catch (e) {
    console.error('\n❌ Test insert FAILED:', e.message);
  }
}

main().catch(e => console.error(e));
