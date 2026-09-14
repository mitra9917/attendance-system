import { Router, Request, Response } from 'express';
import { db } from '../prisma/db.js';
import { requireAuth, AuthPayload } from '../middleware/auth.js';
import { getBlocksForPattern } from '@attendance/shared';

const router = Router();

// POST /api/sessions  — Teacher starts a new attendance session
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { courseId, slotCode, date } = req.body;
  const teacher = (req as any).user as AuthPayload;

  if (!courseId || !slotCode || !date) {
    res.status(400).json({ error: 'courseId, slotCode and date are required' });
    return;
  }

  try {
    const course = await db.orm.public.Course.where({ id: courseId }).first();
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    // Optional: Validate that slotCode belongs to the course's slotPattern
    const blocks = getBlocksForPattern(course.slotPattern);
    if (!blocks.some(b => b.code === slotCode)) {
      res.status(400).json({ error: `Slot code ${slotCode} is not valid for pattern ${course.slotPattern}` });
      return;
    }

    // Prevent duplicate session for same course+slotCode+date
    const dup = await db.orm.public.AttendanceSession.where({ courseId, slotCode, date }).first();
    if (dup) {
      // Return existing session instead of erroring — client can load it
      res.status(200).json({ session: dup, existing: true });
      return;
    }

    const session = await db.orm.public.AttendanceSession.create({
      courseId,
      slotCode,
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

    await db.orm.public.AuditLog.create({
      userId: teacher.userId,
      action: 'SESSION_STARTED',
      entityType: 'AttendanceSession',
      entityId: session.id,
      details: JSON.stringify({ courseId, slotCode, date, teacherId: teacher.userId }),
      ip: req.ip || '',
    });

    res.status(201).json({ session, existing: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// GET /api/sessions  — list sessions, optional ?courseId= or ?courseId=&slotCode=&date= (find specific)
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const courseId = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;
  const slotCode = req.query.slotCode as string | undefined;
  const date = req.query.date as string | undefined;

  try {
    // If all 3 provided, find a specific session
    if (courseId && slotCode && date) {
      const session = await db.orm.public.AttendanceSession.where({ courseId, slotCode, date }).first();
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
// Only shows records for CURRENTLY ENROLLED students — orphan records for unenrolled students are excluded.
// Also reconciles: if students were enrolled AFTER the session started, they won't have
// AttendanceRecord rows yet. We add NOT_MARKED records for them on-the-fly.
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const session = await db.orm.public.AttendanceSession.where({ id }).first();
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

    const course = await db.orm.public.Course.first({ id: session.courseId });

    // Derive slot info from course slotPattern + session slotCode (no Slot DB table)
    let slot: { id: string; name: string; startTime: string; endTime: string; } | null = null;
    if (course) {
      const blocks = getBlocksForPattern(course.slotPattern);
      const block = blocks.find(b => b.code === session.slotCode);
      if (block) {
        slot = { id: block.code, name: block.code, startTime: block.startTime, endTime: block.endTime };
      }
    }

    // Get CURRENT enrollments — this is the authoritative list of who should appear
    const enrollments = await db.orm.public.Enrollment.where({ courseId: session.courseId }).all();
    const enrolledStudentIds = new Set(enrollments.map(e => e.studentId));

    // Get existing attendance records for this session
    const rawRecords = await db.orm.public.AttendanceRecord.where({ sessionId: id }).all();

    // Filter to only records for currently-enrolled students (drop orphan records)
    const enrolledRawRecords = rawRecords.filter(r => enrolledStudentIds.has(r.studentId));
    const existingStudentIds = new Set(enrolledRawRecords.map(r => r.studentId));

    // For any enrolled student missing a record (enrolled after session started),
    // create a NOT_MARKED record so they appear correctly — not as ABSENT
    const supplementedRecords = [...enrolledRawRecords];
    if (session.status !== 'FINALIZED') {
      for (const enrollment of enrollments) {
        if (!existingStudentIds.has(enrollment.studentId)) {
          const newRecord = await db.orm.public.AttendanceRecord.create({
            sessionId: id,
            studentId: enrollment.studentId,
            status: 'NOT_MARKED',
          });
          supplementedRecords.push(newRecord);
        }
      }
    }

    // Enrich records with student info + serialNumber from enrollment
    const records = await Promise.all(
      supplementedRecords.map(async (r) => {
        const student = await db.orm.public.Student.first({ id: r.studentId });
        const enrollment = enrollments.find(e => e.studentId === r.studentId);
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

    const record = await db.orm.public.AttendanceRecord.where({ sessionId, studentId }).first();
    
    if (record) {
      await db.orm.public.AttendanceRecord.where({ sessionId, studentId }).update({
        status,
        method: method || null,
        confidence: confidence ?? null,
        markedAt: status !== 'NOT_MARKED' ? new Date().toISOString() : null,
      });
    } else {
      await db.orm.public.AttendanceRecord.create({
        sessionId,
        studentId,
        status,
        method: method || null,
        confidence: confidence ?? null,
        markedAt: status !== 'NOT_MARKED' ? new Date().toISOString() : null,
      });
    }

    res.json({ message: 'Attendance marked', status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
});

// POST /api/sessions/:id/finalize  — finalize session
// On finalize, all NOT_MARKED records are converted to ABSENT.
// ABSENT only means the session is over and the student was not marked present.
router.post('/:id/finalize', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const session = await db.orm.public.AttendanceSession.where({ id }).first();
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    if (session.status === 'FINALIZED') { res.status(400).json({ error: 'Already finalized' }); return; }

    // Mark all NOT_MARKED students as ABSENT before finalizing, and create missing ones
    const enrollments = await db.orm.public.Enrollment.where({ courseId: session.courseId }).all();
    const existingRecords = await db.orm.public.AttendanceRecord.where({ sessionId: id }).all();
    
    let autoAbsents = 0;
    for (const e of enrollments) {
      const existing = existingRecords.find(r => r.studentId === e.studentId);
      if (!existing) {
        await db.orm.public.AttendanceRecord.create({
          sessionId: id,
          studentId: e.studentId,
          status: 'ABSENT',
          method: null,
          confidence: null,
          markedAt: new Date().toISOString(),
        });
        autoAbsents++;
      } else if (existing.status === 'NOT_MARKED') {
        await db.orm.public.AttendanceRecord.where({ id: existing.id }).update({
          status: 'ABSENT',
          markedAt: new Date().toISOString(),
        });
        autoAbsents++;
      }
    }

    await db.orm.public.AttendanceSession.where({ id }).update({
      status: 'FINALIZED',
      finalizedAt: new Date().toISOString(),
    });

    const teacher = (req as any).user as AuthPayload;
    await db.orm.public.AuditLog.create({
      userId: teacher.userId,
      action: 'SESSION_FINALIZED',
      entityType: 'AttendanceSession',
      entityId: id,
      details: JSON.stringify({ autoAbsents }),
      ip: req.ip || '',
    });

    res.json({ message: 'Session finalized' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to finalize session' });
  }
});

// GET /api/sessions/:id/faces  — fetch all active FaceTemplates for students in this session
router.get('/:id/faces', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const session = await db.orm.public.AttendanceSession.where({ id }).first();
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

    // Find all enrolled students
    const enrollments = await db.orm.public.Enrollment.where({ courseId: session.courseId }).all();
    const studentIds = enrollments.map(e => e.studentId);

    if (studentIds.length === 0) {
      res.json([]);
      return;
    }

    // Fetch active FaceTemplates for these students
    const templates = [];
    for (const sId of studentIds) {
      const sTemplates = await db.orm.public.FaceTemplate.where({ studentId: sId, isActive: true }).all();
      templates.push(...sTemplates);
    }

    // Format the response
    const result = templates.map(row => ({
      id: row.id,
      studentId: row.studentId,
      embedding: typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch session faces' });
  }
});

export default router;
