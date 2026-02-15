const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require');

async function check() {
  // List ALL tables
  const tables = await sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  console.log('=== جميع الجداول الموجودة ===');
  tables.forEach(t => console.log('  - ' + t.table_name));

  // For each table, check columns
  console.log('\n=== أعمدة كل جدول ===');
  for (const t of tables) {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = ${t.table_name} 
      ORDER BY ordinal_position
    `;
    console.log('\n' + t.table_name + ':');
    console.log('  ' + cols.map(c => c.column_name).join(', '));
  }
}
check().catch(e => console.error('ERROR:', e.message));
