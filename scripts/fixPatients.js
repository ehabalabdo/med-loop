// Fix old patients - set username = phone where username is NULL
import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require');

async function fixPatients() {
  try {
    console.log('🔧 Fixing old patients - setting username = phone where NULL...\n');
    
    // Update all patients where username is NULL
    const result = await sql`
      UPDATE patients 
      SET username = phone 
      WHERE username IS NULL AND phone IS NOT NULL AND phone != ''
    `;
    
    console.log(`✅ Updated ${result.length} patients\n`);
    
    // Verify the update
    const updated = await sql`
      SELECT id, full_name, phone, username, has_access 
      FROM patients 
      WHERE phone = '786772232'
    `;
    
    if (updated.length > 0) {
      console.log('📋 Updated patient:');
      console.log(`   ID: ${updated[0].id}`);
      console.log(`   Name: ${updated[0].full_name}`);
      console.log(`   Phone: ${updated[0].phone}`);
      console.log(`   Username: ${updated[0].username}`);
      console.log(`   Has Access: ${updated[0].has_access}`);
    }
    
    console.log('\n✅ Done! All patients can now login with their phone number.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixPatients();
