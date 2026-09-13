// Normalize all existing student registrationNumbers to uppercase
// Run from project root: npx tsx normalize-reg-numbers.ts
import './apps/api/src/prisma/db.js';
import { db } from './apps/api/src/prisma/db.js';

async function main() {
  const students = await db.orm.public.Student.all();
  let updated = 0;
  for (const s of students) {
    const normalized = s.registrationNumber.trim().toUpperCase();
    if (normalized !== s.registrationNumber) {
      // Check if another student already has this normalized number (edge case: two rows differ only in case)
      const dup = await db.orm.public.Student.where({ registrationNumber: normalized }).first();
      if (dup && dup.id !== s.id) {
        console.warn(`CONFLICT: student id=${s.id} (${s.registrationNumber}) collides with id=${dup.id} (${dup.registrationNumber}) after normalization. Skipping.`);
        continue;
      }
      await db.orm.public.Student.where({ id: s.id }).update({ registrationNumber: normalized });
      console.log(`Updated id=${s.id}: "${s.registrationNumber}" → "${normalized}"`);
      updated++;
    }
  }
  console.log(`Done. Updated ${updated} record(s).`);
}

main().catch(e => { console.error(e); process.exit(1); });
