const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require');

(async () => {
  try {
    // Make doctor_id nullable
    await sql`ALTER TABLE appointments ALTER COLUMN doctor_id DROP NOT NULL`;
    console.log('doctor_id is now NULLABLE');

    // Verify
    const cols = await sql`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'doctor_id'`;
    console.log('doctor_id nullable:', cols[0].is_nullable);

    // Test insert with a real patient
    const patients = await sql`SELECT id FROM patients LIMIT 1`;
    if (patients.length > 0) {
      const testResult = await sql`
        INSERT INTO appointments (patient_id, patient_name, clinic_id, doctor_id, start_time, end_time, status, reason, created_at)
        VALUES (${patients[0].id}, 'Test Patient', 2, NULL, NOW(), NOW() + INTERVAL '1 hour', 'scheduled', 'Test', NOW())
        RETURNING id
      `;
      console.log('Test insert succeeded, id:', testResult[0].id);

      // Clean up test
      await sql`DELETE FROM appointments WHERE id = ${testResult[0].id}`;
      console.log('Test record cleaned up');
    } else {
      console.log('No patients found - skipping test insert');
    }

  } catch(e) {
    console.error('Error:', e.message);
  }
})();
