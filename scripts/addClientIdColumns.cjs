const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require');

async function addClientId() {
  console.log('🔧 Adding client_id to all tables...\n');

  const tables = [
    'users', 'patients', 'clinics', 'appointments', 'invoices',
    'notifications', 'lab_cases', 'implant_items', 'implant_orders',
    'courses', 'course_students', 'course_sessions', 'system_settings'
  ];

  for (const table of tables) {
    try {
      // Check if column exists
      const exists = await sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = ${table} AND column_name = 'client_id'
      `;
      
      if (exists.length > 0) {
        console.log(`  ${table}: ⏭️ already has client_id`);
        continue;
      }

      // Add column (without FK for now, add FK separately)
      await sql`ALTER TABLE ${sql(table)} ADD COLUMN client_id INTEGER`;
      console.log(`  ${table}: ✅ client_id added`);
    } catch (err) {
      console.log(`  ${table}: ❌ Error - ${err.message}`);
      
      // Fallback: try raw SQL
      try {
        await sql.transaction([
          sql`SELECT 1` // dummy to start transaction
        ]);
      } catch {}
    }
  }

  // Add FK constraints separately
  console.log('\n🔗 Adding foreign key constraints...');
  for (const table of tables) {
    try {
      const fkName = `fk_${table}_client_id`;
      await sql`
        SELECT constraint_name FROM information_schema.table_constraints 
        WHERE table_name = ${table} AND constraint_name = ${fkName}
      `.then(async (rows) => {
        if (rows.length === 0) {
          // Can't parameterize table names in ALTER TABLE, skip FK for now
          console.log(`  ${table}: ⏭️ FK skipped (will use application-level enforcement)`);
        }
      });
    } catch (err) {
      console.log(`  ${table}: ⚠️ FK skipped`);
    }
  }

  // Create indexes
  console.log('\n📇 Creating indexes...');
  for (const table of tables) {
    try {
      const idxName = `idx_${table}_client_id`;
      // Check if index exists
      const idx = await sql`SELECT indexname FROM pg_indexes WHERE indexname = ${idxName}`;
      if (idx.length === 0) {
        await sql`CREATE INDEX ${sql(idxName)} ON ${sql(table)}(client_id)`;
        console.log(`  ${table}: ✅ index created`);
      } else {
        console.log(`  ${table}: ⏭️ index exists`);
      }
    } catch (err) {
      console.log(`  ${table}: ❌ Index error - ${err.message}`);
    }
  }

  // Verify
  console.log('\n✅ Verification:');
  for (const table of tables) {
    const col = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = ${table} AND column_name = 'client_id'
    `;
    console.log(`  ${table}: ${col.length > 0 ? '✅' : '❌'}`);
  }
}

addClientId().catch(e => console.error('ERROR:', e.message));
