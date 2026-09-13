import { Router, Request, Response } from 'express';
import { db } from '../prisma/db.js';
import { requireAuth, AuthPayload } from '../middleware/auth.js';

const router = Router();

// POST /api/sessions  — Teacher starts a new attendance session
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { courseId, slotId, date } = req.body;
  const teacher = (req as any).user as AuthPayload;

  if (!courseId || !slotId || !date) {
    res.status(400).json({ error: 'courseId, slotId and date are required' });
    return;
  }

  try {
    // Prevent duplicate session for same course+slot+date
    const dup = await db.orm.public.AttendanceSession.where({ courseId, slotId, date }).first();
    if (dup) {
      // Return existing session instead of erroring — client can load it
      res.status(200).json({ session: dup, existing: true });
      return;
    }

    const session = await db.orm.public.AttendanceSession.create({
      courseId,
      slotId,
      teacherId: teacher.userId,
      date,
      status: 'ONGOING',
    });

    // Pre-populate AttendanceRecord rows for all enrolled students (status = NOT_MARKED)
    const enrollments = await db.orm.public.Enrollment.where({ courseId }).all();
    for (const e of enrollments) {
      await db.orm.public.AttendanceRecord.create({
        sessionId: session.id,
        studentId: e.studentId,
        status: 'NOT_MARKED',
      });
    }

    res.status(201).json({ session, existing: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// GET /api/sessions  — list sessions, optional ?courseId= or ?courseId=&slotId=&date= (find specific)
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const courseId = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;
  const slotId = req.query.slotId ? parseInt(req.query.slotId as string) : undefined;
  const date = req.query.date as string | undefined;

  try {
    // If all 3 provided, find a specific session
    if (courseId && slotId && date) {
      const session = await db.orm.public.AttendanceSession.where({ courseId, slotId, date }).first();
      res.json(session ? [session] : []);
      return;
    }

    const sessions = courseId
      ? await db.orm.public.AttendanceSession.where({ courseId }).all()
      : await db.orm.public.AttendanceSession.all();
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/sessions/:id  — session detail with enriched records (student name + regNo + serialNumber)
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const session = await db.orm.public.AttendanceSession.where({ id }).first();
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

    const [rawRecords, course, slot] = await Promise.all([
      db.orm.public.AttendanceRecord.where({ sessionId: id }).all(),
      db.orm.public.Course.first({ id: session.courseId }),
      db.orm.public.Slot.first({ id: session.slotId }),
    ]);

    // Enrich records with student info + serialNumber from enrollment
    const records = await Promise.all(
      rawRecords.map(async (r) => {
        const student = await db.orm.public.Student.first({ id: r.studentId });
        const enrollment = await db.orm.public.Enrollment.where({ courseId: session.courseId, studentId: r.studentId }).first();
        return {
          id: r.id,
          sessionId: r.sessionId,
          studentId: r.studentId,
          status: r.status,
          method: r.method,
          confidence: r.confidence,
          markedAt: r.markedAt,
          student: student ? {
            id: student.id,
            name: student.name,
            registrationNumber: student.registrationNumber,
            photoUrl: student.photoUrl,
          } : null,
          serialNumber: enrollment?.serialNumber ?? null,
        };
      })
    );

    // Sort by serialNumber
    records.sort((a, b) => (a.serialNumber ?? 999) - (b.serialNumber ?? 999));

    res.json({ session, course, slot, records });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// PATCH /api/sessions/:id/records/:studentId  — mark attendance for a student
router.patch('/:id/records/:studentId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const sessionId = parseInt(req.params.id);
  const studentId = parseInt(req.params.studentId);
  const { status, method, confidence } = req.body;

  const validStatuses = ['PRESENT', 'ABSENT', 'NOT_MARKED'];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    return;
  }

  try {
    const session = await db.orm.public.AttendanceSession.where({ id: sessionId }).first();
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    if (session.status === 'FINALIZED') { res.status(400).json({ error: 'Session is finalized' }); return; }

    const record = await db.orm.public.AttendanceRecord.where({ sessionId, studentId }).first();
    if (!record) { res.status(404).json({ error: 'Attendance record not found' }); return; }

    await db.orm.public.AttendanceRecord.where({ sessionId, studentId }).update({
      status,
      method: method || null,
      confidence: confidence ?? null,
      markedAt: status !== 'NOT_MARKED' ? new Date().toISOString() : null,
    });

    res.json({ message: 'Attendance marked', status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
});

// POST /api/sessions/:id/finalize  — finalize session
router.post('/:id/finalize', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const session = await db.orm.public.AttendanceSession.where({ id }).first();
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    if (session.status === 'FINALIZED') { res.status(400).json({ error: 'Already finalized' }); return; }

    await db.orm.public.AttendanceSession.where({ id }).update({
      status: 'FINALIZED',
      finalizedAt: new Date().toISOString(),
    });

    res.json({ message: 'Session finalized' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to finalize session' });
  }
});

export default router;
