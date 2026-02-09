// Check patients in database
import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require');

async function checkPatients() {
  try {
    console.log('🔍 Checking patients in database...\n');
    
    const patients = await sql`
      SELECT id, full_name, phone, username, password, has_access 
      FROM patients 
      WHERE phone = '786772232' OR phone = '0791234567' OR username = '786772232' OR username = '0791234567'
      ORDER BY id DESC
      LIMIT 5
    `;
    
    console.log(`Found ${patients.length} matching patients:\n`);
    
    patients.forEach(p => {
      console.log(`📋 Patient ID: ${p.id}`);
      console.log(`   Name: ${p.full_name}`);
      console.log(`   Phone: ${p.phone}`);
      console.log(`   Username: ${p.username || 'NULL'}`);
      console.log(`   Password: ${p.password || 'NULL'}`);
      console.log(`   Has Access: ${p.has_access}`);
      console.log('');
    });
    
    // Check all patients with access
    const allWithAccess = await sql`
      SELECT COUNT(*) as count FROM patients WHERE has_access = true
    `;
    console.log(`Total patients with access: ${allWithAccess[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPatients();
