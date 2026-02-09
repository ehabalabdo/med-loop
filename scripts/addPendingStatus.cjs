const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_6nJUYTxI9yXP@ep-empty-boat-ag13jwix-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require');

(async () => {
  try {
    // Check current constraint
    const constraints = await sql`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'appointments'::regclass AND contype = 'c'
    `;
    console.log('Current constraints:', constraints);

    // Drop old check constraint and add new one with 'pending'
    await sql`ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check`;
    console.log('Dropped old constraint');

    // Add new constraint with 'pending' included
    await sql`ALTER TABLE appointments ADD CONSTRAINT appointments_status_check 
      CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed', 'no-show', 'pending'))`;
    console.log('Added new constraint with pending status');

    // Verify
    const after = await sql`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'appointments'::regclass AND contype = 'c'
    `;
    console.log('Updated constraints:', after);
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
