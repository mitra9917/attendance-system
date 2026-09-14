import { Router, Request, Response } from 'express';
import { db } from '../prisma/db.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/enrollments?courseId=  (any auth) — returns enriched data
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const courseId = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;
  try {
    const enrollments = courseId
      ? await db.orm.public.Enrollment.where({ courseId }).all()
      : await db.orm.public.Enrollment.all();

    // Enrich with student + course data
    const enriched = await Promise.all(
      enrollments.map(async (e) => {
        const [student, course] = await Promise.all([
          db.orm.public.Student.first({ id: e.studentId }),
          db.orm.public.Course.first({ id: e.courseId }),
        ]);
        return {
          id: e.id,
          courseId: e.courseId,
          studentId: e.studentId,
          serialNumber: e.serialNumber,
          enrolledAt: e.enrolledAt,
          student: student ? { id: student.id, name: student.name, registrationNumber: student.registrationNumber, photoUrl: student.photoUrl } : null,
          course: course ? { id: course.id, code: course.code, name: course.name, slotPattern: course.slotPattern } : null,
        };
      })
    );
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// POST /api/enrollments  (Admin) — enroll a student in a course
// A student (by normalized registration number) must be unique within a course,
// but the same student can be enrolled in multiple different courses.
router.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { courseId, studentId } = req.body;
  if (!courseId || !studentId) {
    res.status(400).json({ error: 'courseId and studentId are required' });
    return;
  }
  try {
    // Check for duplicate enrollment (same student, same course)
    const dup = await db.orm.public.Enrollment.where({ courseId, studentId }).first();
    if (dup) { res.status(409).json({ error: 'Student already enrolled in this course' }); return; }

    // Also enforce: no two enrollments in the same course can share the same registrationNumber.
    // Since registrationNumber is on Student and is already normalized to uppercase, we just
    // check if another student with the same registrationNumber is already enrolled in this course.
    const student = await db.orm.public.Student.where({ id: studentId }).first();
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

    const existingEnrollmentsInCourse = await db.orm.public.Enrollment.where({ courseId }).all();
    for (const e of existingEnrollmentsInCourse) {
      const s = await db.orm.public.Student.where({ id: e.studentId }).first();
      if (s && s.registrationNumber.toUpperCase() === student.registrationNumber.toUpperCase()) {
        res.status(409).json({ error: `Registration number "${student.registrationNumber}" is already enrolled in this course` });
        return;
      }
    }

    // Compute next serialNumber within the course using MAX to avoid conflicts when
    // students have been deleted (count would be less than the highest existing serial number)
    const maxSerial = existingEnrollmentsInCourse.reduce((max, e) => Math.max(max, e.serialNumber ?? 0), 0);
    const serialNumber = maxSerial + 1;

    const enrollment = await db.orm.public.Enrollment.create({ courseId, studentId, serialNumber });
    res.status(201).json(enrollment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to enroll student' });
  }
});

// DELETE /api/enrollments/:id  (Admin) — remove enrollment
router.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const existing = await db.orm.public.Enrollment.where({ id }).first();
    if (!existing) { res.status(404).json({ error: 'Enrollment not found' }); return; }

    // Clean up AttendanceRecord rows for this student in ONGOING sessions of this course.
    // FINALIZED sessions are left intact to preserve historical data.
    const ongoingSessions = await db.orm.public.AttendanceSession.where({ courseId: existing.courseId, status: 'ONGOING' }).all();
    for (const session of ongoingSessions) {
      await db.orm.public.AttendanceRecord.where({ sessionId: session.id, studentId: existing.studentId }).delete();
    }

    await db.orm.public.Enrollment.where({ id }).delete();
    res.json({ message: 'Enrollment removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove enrollment' });
  }
});

export default router;
