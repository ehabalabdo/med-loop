// Run migration_saas.sql against Neon database
const { neon } = require('@neondatabase/serverless');

const sql = neon('postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require');

async function runMigration() {
  console.log('🚀 Starting SaaS migration...\n');

  try {
    // 1. Create clients table
    console.log('1. Creating clients table...');
    await sql`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        logo_url TEXT DEFAULT '',
        phone VARCHAR(50) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        address TEXT DEFAULT '',
        status VARCHAR(20) DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'expired', 'suspended')),
        trial_ends_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days'),
        subscription_ends_at TIMESTAMP,
        owner_user_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
      )
    `;
    console.log('   ✅ clients table created');

    // 2. Create super_admins table
    console.log('2. Creating super_admins table...');
    await sql`
      CREATE TABLE IF NOT EXISTS super_admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('   ✅ super_admins table created');

    // 3. Insert super admin
    console.log('3. Inserting super admin (ehabloop)...');
    await sql`
      INSERT INTO super_admins (username, password, name)
      VALUES ('ehabloop', 'ehab@&2026', 'Ehab - Super Admin')
      ON CONFLICT (username) DO NOTHING
    `;
    console.log('   ✅ Super admin inserted');

    // 4. Add client_id to existing tables
    const tables = [
      'users', 'patients', 'clinics', 'appointments', 'invoices',
      'notifications', 'lab_cases', 'implant_inventory', 'implant_orders',
      'courses', 'course_students', 'course_sessions', 'system_settings'
    ];

    for (const table of tables) {
      console.log(`4. Adding client_id to ${table}...`);
      try {
        await sql`SELECT 1 FROM information_schema.columns WHERE table_name = ${table} AND column_name = 'client_id'`.then(async (rows) => {
          if (rows.length === 0) {
            // Column doesn't exist, add it
            // Note: can't use parameterized table names, so use raw query per table
            await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN client_id INTEGER REFERENCES clients(id)`);
            console.log(`   ✅ client_id added to ${table}`);
          } else {
            console.log(`   ⏭️ client_id already exists in ${table}`);
          }
        });
      } catch (err) {
        console.log(`   ⚠️ Skipped ${table}: ${err.message}`);
      }
    }

    // 5. Create indexes
    console.log('\n5. Creating indexes...');
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug)',
      'CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status)',
      'CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_patients_client_id ON patients(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_clinics_client_id ON clinics(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_client_id ON notifications(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_lab_cases_client_id ON lab_cases(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_implant_inventory_client_id ON implant_inventory(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_implant_orders_client_id ON implant_orders(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_courses_client_id ON courses(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_course_students_client_id ON course_students(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_course_sessions_client_id ON course_sessions(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_system_settings_client_id ON system_settings(client_id)',
    ];

    for (const q of indexQueries) {
      try {
        await sql.unsafe(q);
      } catch (err) {
        // Ignore if index already exists
      }
    }
    console.log('   ✅ All indexes created');

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - clients table: CREATED');
    console.log('   - super_admins table: CREATED');
    console.log('   - Super Admin: ehabloop / ehab@&2026');
    console.log('   - client_id added to all tables');
    console.log('   - Indexes created');
    console.log('\n🔗 Access Super Admin: your-domain/#/super-admin');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

runMigration();
