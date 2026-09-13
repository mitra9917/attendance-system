import { Router, Request, Response } from 'express';
import { db } from '../prisma/db.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/students  (any auth)
router.get('/', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const students = await db.orm.public.Student.where({ isActive: true }).all();
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// GET /api/students/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const student = await db.orm.public.Student.where({ id, isActive: true }).first();
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }
    res.json(student);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// POST /api/students  (Admin only)
router.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { registrationNumber, name, email } = req.body;
  if (!registrationNumber || !name) {
    res.status(400).json({ error: 'registrationNumber and name are required' });
    return;
  }
  try {
    const existing = await db.orm.public.Student.where({ registrationNumber }).first();
    if (existing) { res.status(409).json({ error: 'Registration number already exists' }); return; }

    const student = await db.orm.public.Student.create({ registrationNumber, name, email: email || null, isActive: true });
    res.status(201).json(student);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// PUT /api/students/:id  (Admin only)
router.put('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, email } = req.body;
  try {
    const existing = await db.orm.public.Student.where({ id, isActive: true }).first();
    if (!existing) { res.status(404).json({ error: 'Student not found' }); return; }

    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (email !== undefined) updates.email = email || null;

    await db.orm.public.Student.where({ id }).update(updates);
    res.json({ message: 'Student updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// DELETE /api/students/:id  (Admin only) — hard delete
router.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    // Manually delete related records first to avoid foreign key constraints
    await db.orm.public.AttendanceRecord.where({ studentId: id }).delete();
    await db.orm.public.Enrollment.where({ studentId: id }).delete();
    await db.orm.public.FaceTemplate.where({ studentId: id }).delete();

    // Finally delete the student
    await db.orm.public.Student.where({ id }).delete();
    res.json({ message: 'Student deleted from database' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

export default router;
