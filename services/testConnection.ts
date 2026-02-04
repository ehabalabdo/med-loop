// Test PostgreSQL connection
import { pgUsers, pgClinics, pgPatients } from './pgServices';

async function testConnection() {
  try {
    console.log('🔍 Testing Neon connection...');
    
    // Test 1: Get all users
    console.log('\n1️⃣ Testing users...');
    const users = await pgUsers.getAll();
    console.log(`✅ Found ${users.length} users:`, users.map(u => ({ id: u.uid, name: u.name, role: u.role })));
    
    // Test 2: Get all clinics
    console.log('\n2️⃣ Testing clinics...');
    const clinics = await pgClinics.getAll();
    console.log(`✅ Found ${clinics.length} clinics:`, clinics.map(c => ({ id: c.id, name: c.name })));
    
    // Test 3: Get all patients
    console.log('\n3️⃣ Testing patients...');
    const patients = await pgPatients.getAll();
    console.log(`✅ Found ${patients.length} patients:`, patients.map(p => ({ id: p.id, name: p.name, phone: p.phone })));
    
    console.log('\n✅ All tests passed! Neon connection is working.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection test failed:', error);
    process.exit(1);
  }
}

testConnection();
