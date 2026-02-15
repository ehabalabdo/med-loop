const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require');

async function check() {
  console.log('=== فحص قاعدة البيانات ===\n');

  // 1. Check clients table exists
  const clients = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'clients'`;
  console.log('1. جدول clients:', clients.length > 0 ? '✅ موجود' : '❌ غير موجود');

  // 2. Check super_admins table
  const sa = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'super_admins'`;
  console.log('2. جدول super_admins:', sa.length > 0 ? '✅ موجود' : '❌ غير موجود');

  // 3. Check super admin user
  const admin = await sql`SELECT username, name FROM super_admins`;
  console.log('3. Super Admin:', admin.length > 0 ? '✅ ' + admin[0].username + ' (' + admin[0].name + ')' : '❌ غير موجود');

  // 4. Check client_id in all tables
  const tables = ['users','patients','clinics','appointments','invoices','notifications','lab_cases','implant_inventory','implant_orders','courses','course_students','course_sessions','system_settings'];
  console.log('\n4. فحص client_id في الجداول:');
  for (const t of tables) {
    const col = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${t} AND column_name = 'client_id'`;
    console.log('   ' + t + ': ' + (col.length > 0 ? '✅' : '❌'));
  }

  // 5. Check clients table structure
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clients' ORDER BY ordinal_position`;
  console.log('\n5. هيكل جدول clients:');
  cols.forEach(c => console.log('   - ' + c.column_name + ' (' + c.data_type + ')'));

  // 6. Check if any clients exist
  const clientCount = await sql`SELECT COUNT(*)::int as count FROM clients`;
  console.log('\n6. عدد الزبائن الحاليين:', clientCount[0].count);
}
check().catch(e => console.error('ERROR:', e.message));
