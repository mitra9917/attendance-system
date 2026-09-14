import { Router, Request, Response } from 'express';
import { db } from '../prisma/db.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/courses
router.get('/', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const courses = await db.orm.public.Course.where({ isActive: true }).all();
    
    // Enrich with student count from Enrollment
    const enriched = await Promise.all(
      courses.map(async (course) => {
        const enrollments = await db.orm.public.Enrollment.where({ courseId: course.id }).all();
        return {
          ...course,
          studentCount: enrollments.length,
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// GET /api/courses/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const course = await db.orm.public.Course.where({ id, isActive: true }).first();
    if (!course) { res.status(404).json({ error: 'Course not found' }); return; }
    res.json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// POST /api/courses  (Admin)
router.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { code, name, type, slotPattern } = req.body;
  if (!code || !name || !type || !slotPattern) {
    res.status(400).json({ error: 'code, name, type and slotPattern are required' });
    return;
  }
  try {
    const existing = await db.orm.public.Course.where({ code, slotPattern }).first();
    if (existing) { res.status(409).json({ error: 'Course with this code and slot pattern already exists' }); return; }

    const course = await db.orm.public.Course.create({ code, name, type, slotPattern, isActive: true });
    res.status(201).json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// PUT /api/courses/:id  (Admin)
router.put('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, code, type, slotPattern } = req.body;
  try {
    const existing = await db.orm.public.Course.where({ id, isActive: true }).first();
    if (!existing) { res.status(404).json({ error: 'Course not found' }); return; }

    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (code) updates.code = code;
    if (type) updates.type = type;
    if (slotPattern) updates.slotPattern = slotPattern;

    await db.orm.public.Course.where({ id }).update(updates);
    res.json({ message: 'Course updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// DELETE /api/courses/:id  (Admin) — hard delete
router.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    // Delete AttendanceRecords for all sessions of this course
    const sessions = await db.orm.public.AttendanceSession.where({ courseId: id }).all();
    for (const session of sessions) {
      await db.orm.public.AttendanceRecord.where({ sessionId: session.id }).delete();
    }
    
    // Delete Sessions and Enrollments
    await db.orm.public.AttendanceSession.where({ courseId: id }).delete();
    await db.orm.public.Enrollment.where({ courseId: id }).delete();
    
    // Finally delete the course
    await db.orm.public.Course.where({ id }).delete();
    res.json({ message: 'Course deleted from database' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

export default router;
