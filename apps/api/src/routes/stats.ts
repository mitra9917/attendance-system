import { Router, Request, Response } from 'express';
import { db } from '../prisma/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/stats — dashboard statistics from live DB data
router.get('/', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

    const [courses, students, totalSessions] = await Promise.all([
      db.orm.public.Course.where({ isActive: true }).all(),
      db.orm.public.Student.where({ isActive: true }).all(),
      db.orm.public.AttendanceSession.all(),
    ]);

    // Count sessions today
    const sessionsToday = totalSessions.filter(s => s.date === today);

    // Count PRESENT marks across all today's sessions
    let presentToday = 0;
    let totalMarkedToday = 0;
    if (sessionsToday.length > 0) {
      for (const session of sessionsToday) {
        const records = await db.orm.public.AttendanceRecord.where({ sessionId: session.id }).all();
        presentToday += records.filter(r => r.status === 'PRESENT').length;
        totalMarkedToday += records.filter(r => r.status !== 'NOT_MARKED').length;
      }
    }

    res.json({
      courses: courses.length,
      students: students.length,
      sessionsToday: sessionsToday.length,
      presentToday,
      totalMarkedToday,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
