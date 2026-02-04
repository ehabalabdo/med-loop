// Script to clear all patients from database
import sql from '../services/db';

async function clearAllPatients() {
  try {
    console.log('🗑️  Clearing all patients from database...');
    
    const result = await sql`DELETE FROM patients`;
    
    console.log('✅ All patients deleted successfully!');
    console.log(`Deleted ${result.length} patients`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing patients:', error);
    process.exit(1);
  }
}

clearAllPatients();
