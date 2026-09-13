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
          course: course ? { id: course.id, code: course.code, name: course.name, slotId: course.slotId } : null,
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
router.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { courseId, studentId } = req.body;
  if (!courseId || !studentId) {
    res.status(400).json({ error: 'courseId and studentId are required' });
    return;
  }
  try {
    // Check for duplicate
    const dup = await db.orm.public.Enrollment.where({ courseId, studentId }).first();
    if (dup) { res.status(409).json({ error: 'Student already enrolled in this course' }); return; }

    // Compute next serialNumber within the course
    const existing = await db.orm.public.Enrollment.where({ courseId }).all();
    const serialNumber = existing.length + 1;

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

    await db.orm.public.Enrollment.where({ id }).delete();
    res.json({ message: 'Enrollment removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove enrollment' });
  }
});

export default router;
