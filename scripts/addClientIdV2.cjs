const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require');

async function addClientId() {
  console.log('🔧 Adding client_id to all tables...\n');

  // Use raw SQL queries with sql.query() for dynamic table names
  const alterQueries = [
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS client_id INTEGER',
    'ALTER TABLE patients ADD COLUMN IF NOT EXISTS client_id INTEGER',
    'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS client_id INTEGER',
    'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_id INTEGER',
    'ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_id INTEGER',
    'ALTER TABLE notifications ADD COLUMN IF NOT EXISTS client_id INTEGER',
    'ALTER TABLE lab_cases ADD COLUMN IF NOT EXISTS client_id INTEGER',
    'ALTER TABLE implant_items ADD COLUMN IF NOT EXISTS client_id INTEGER',
    'ALTER TABLE implant_orders ADD COLUMN IF NOT EXISTS client_id INTEGER',
    'ALTER TABLE courses ADD COLUMN IF NOT EXISTS client_id INTEGER',
    'ALTER TABLE course_students ADD COLUMN IF NOT EXISTS client_id INTEGER',
    'ALTER TABLE course_sessions ADD COLUMN IF NOT EXISTS client_id INTEGER',
    'ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS client_id INTEGER',
  ];

  for (const q of alterQueries) {
    try {
      await sql.query(q);
      const table = q.match(/ALTER TABLE (\w+)/)[1];
      console.log(`  ${table}: ✅ client_id added`);
    } catch (err) {
      const table = q.match(/ALTER TABLE (\w+)/)?.[1] || 'unknown';
      if (err.message.includes('already exists')) {
        console.log(`  ${table}: ⏭️ already exists`);
      } else {
        console.log(`  ${table}: ❌ ${err.message}`);
      }
    }
  }

  // Create indexes
  console.log('\n📇 Creating indexes...');
  const indexQueries = [
    'CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_patients_client_id ON patients(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_clinics_client_id ON clinics(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_client_id ON notifications(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_lab_cases_client_id ON lab_cases(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_implant_items_client_id ON implant_items(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_implant_orders_client_id ON implant_orders(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_courses_client_id ON courses(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_course_students_client_id ON course_students(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_course_sessions_client_id ON course_sessions(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_system_settings_client_id ON system_settings(client_id)',
  ];

  for (const q of indexQueries) {
    try {
      await sql.query(q);
      console.log('  ✅ ' + q.match(/ON (\w+)/)[1]);
    } catch (err) {
      console.log('  ⚠️ ' + err.message.substring(0, 60));
    }
  }

  // Verify
  console.log('\n✅ Final Verification:');
  const tables = ['users','patients','clinics','appointments','invoices','notifications',
    'lab_cases','implant_items','implant_orders','courses','course_students','course_sessions','system_settings'];
  
  for (const t of tables) {
    const col = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = ${t} AND column_name = 'client_id'
    `;
    console.log(`  ${t}: ${col.length > 0 ? '✅' : '❌'}`);
  }
}

addClientId().catch(e => console.error('ERROR:', e.message));
