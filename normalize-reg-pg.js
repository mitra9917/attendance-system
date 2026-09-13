// Normalize existing student registration numbers to uppercase.
// If two students exist that differ only by case (e.g. "24bce5281" and "24BCE5281"),
// merge them: re-point all enrollments/attendance records from the lowercase duplicate
// to the primary (uppercase) student, then delete the duplicate.
// Run: node normalize-reg-pg.js

const { Client } = require('pg');
require('dotenv').config({ path: './apps/api/.env' });

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  console.log('Connected to database');

  // Find all students grouped by normalized (uppercase) registration number
  const { rows: dupes } = await client.query(`
    SELECT UPPER(TRIM("registrationNumber")) AS norm, array_agg(id ORDER BY id ASC) AS ids
    FROM student
    GROUP BY UPPER(TRIM("registrationNumber"))
    HAVING COUNT(*) > 1
  `);

  if (dupes.length > 0) {
    console.log(`Found ${dupes.length} group(s) with duplicate registration numbers (case differences):`);
    for (const dupe of dupes) {
      const primaryId = dupe.ids[0];       // keep first (lowest id)
      const duplicateIds = dupe.ids.slice(1);
      console.log(`  norm="${dupe.norm}", primary id=${primaryId}, merging ids=[${duplicateIds.join(',')}]`);

      for (const dupId of duplicateIds) {
        // Move enrollments
        const { rowCount: ec } = await client.query(
          `UPDATE enrollment SET "studentId" = $1 WHERE "studentId" = $2 AND NOT EXISTS (
            SELECT 1 FROM enrollment WHERE "studentId" = $1 AND "courseId" = enrollment."courseId"
          )`,
          [primaryId, dupId]
        );
        console.log(`    Moved ${ec} enrollment(s) from id=${dupId} to id=${primaryId}`);

        // Move attendance records
        const { rowCount: arc } = await client.query(
          `UPDATE "attendanceRecord" SET "studentId" = $1 WHERE "studentId" = $2`,
          [primaryId, dupId]
        );
        console.log(`    Moved ${arc} attendanceRecord(s) from id=${dupId} to id=${primaryId}`);

        // Move face templates
        const { rowCount: ftc } = await client.query(
          `UPDATE "faceTemplate" SET "studentId" = $1 WHERE "studentId" = $2`,
          [primaryId, dupId]
        );
        console.log(`    Moved ${ftc} faceTemplate(s) from id=${dupId} to id=${primaryId}`);

        // Delete any leftover orphan enrollments that couldn't be moved (already-enrolled conflict)
        await client.query(`DELETE FROM enrollment WHERE "studentId" = $1`, [dupId]);
        // Delete the duplicate student
        await client.query(`DELETE FROM student WHERE id = $1`, [dupId]);
        console.log(`    Deleted duplicate student id=${dupId}`);
      }

      // Normalize the primary student's registration number
      await client.query(
        `UPDATE student SET "registrationNumber" = $1 WHERE id = $2`,
        [dupe.norm, primaryId]
      );
      console.log(`    Updated primary id=${primaryId} registrationNumber → "${dupe.norm}"`);
    }
  } else {
    console.log('No duplicate students found.');
  }

  // Now update all remaining non-normalized registration numbers
  const { rows: updated } = await client.query(`
    UPDATE student
    SET "registrationNumber" = UPPER(TRIM("registrationNumber"))
    WHERE "registrationNumber" != UPPER(TRIM("registrationNumber"))
    RETURNING id, "registrationNumber"
  `);

  if (updated.length > 0) {
    console.log(`\nNormalized ${updated.length} additional record(s):`);
    updated.forEach(r => console.log(`  id=${r.id} → "${r.registrationNumber}"`));
  } else {
    console.log('\nAll remaining registration numbers are already normalized.');
  }

  await client.end();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
