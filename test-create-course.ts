import { db } from './apps/api/src/prisma/db.js';

async function test() {
  try {
    const course = await db.orm.public.Course.create({
      code: 'TEST101',
      name: 'Test Course',
      type: 'THEORY',
      slotPattern: 'A1',
      isActive: true,
    });
    console.log('Success:', course);
  } catch (err) {
    console.error('Error creating course:');
    console.error(err);
  }
}

test();
