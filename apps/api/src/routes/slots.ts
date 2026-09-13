import { Router, Request, Response } from 'express';
import { db } from '../prisma/db.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/slots
router.get('/', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const slots = await db.orm.public.Slot.where({ isActive: true }).all();
    res.json(slots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// GET /api/slots/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const slot = await db.orm.public.Slot.where({ id, isActive: true }).first();
    if (!slot) { res.status(404).json({ error: 'Slot not found' }); return; }
    res.json(slot);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch slot' });
  }
});

// POST /api/slots  (Admin)
router.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { name, startTime, endTime } = req.body;
  if (!name || !startTime || !endTime) {
    res.status(400).json({ error: 'name, startTime and endTime are required' });
    return;
  }
  try {
    const existing = await db.orm.public.Slot.where({ name }).first();
    if (existing) { res.status(409).json({ error: 'Slot name already exists' }); return; }

    const slot = await db.orm.public.Slot.create({ name, startTime, endTime, isActive: true });
    res.status(201).json(slot);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create slot' });
  }
});

// PUT /api/slots/:id  (Admin)
router.put('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, startTime, endTime } = req.body;
  try {
    const existing = await db.orm.public.Slot.where({ id, isActive: true }).first();
    if (!existing) { res.status(404).json({ error: 'Slot not found' }); return; }

    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (startTime) updates.startTime = startTime;
    if (endTime) updates.endTime = endTime;

    await db.orm.public.Slot.where({ id }).update(updates);
    res.json({ message: 'Slot updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update slot' });
  }
});

// DELETE /api/slots/:id  (Admin) — hard delete
router.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    // Delete AttendanceRecords for all sessions of this slot
    const sessions = await db.orm.public.AttendanceSession.where({ slotId: id }).all();
    for (const session of sessions) {
      await db.orm.public.AttendanceRecord.where({ sessionId: session.id }).delete();
    }

    // Delete Sessions
    await db.orm.public.AttendanceSession.where({ slotId: id }).delete();
    
    // Finally delete the slot
    await db.orm.public.Slot.where({ id }).delete();
    res.json({ message: 'Slot deleted from database' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete slot' });
  }
});

export default router;
