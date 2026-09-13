import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../prisma/db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/users  (Admin only)
router.get('/', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await db.orm.public.User.where({ isActive: true }).all();
    res.json(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:id  (Admin only)
router.get('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const user = await db.orm.public.User.first({ id });
    if (!user || !user.isActive) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/users/:id  (Admin only)
router.put('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, email, password, role } = req.body;
  try {
    const existing = await db.orm.public.User.first({ id });
    if (!existing || !existing.isActive) { res.status(404).json({ error: 'User not found' }); return; }

    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (role) updates.role = role.toUpperCase();
    if (password) updates.passwordHash = await bcrypt.hash(password, 12);

    await db.orm.public.User.where({ id }).update(updates);
    res.json({ message: 'User updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id  (Admin only) — soft delete
router.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    await db.orm.public.User.where({ id }).update({ isActive: false });
    res.json({ message: 'User deactivated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

export default router;
