import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { CalendarDays, ChevronRight, CheckCircle2, XCircle, Lock, Clock, Scan, UserCheck } from 'lucide-react';
import { getBlocksForPattern } from '@attendance/shared';
import type { DayOfWeek } from '@attendance/shared';
import { FaceScanner } from '../components/FaceScanner';
import './Attendance.css';

interface Course {
  id: number;
  code: string;
  name: string;
  type: string;
  slotPattern: string;
}

interface AttendanceRecord {
  id: number;
  sessionId: number;
  studentId: number;
  status: 'PRESENT' | 'ABSENT' | 'NOT_MARKED';
  method: string | null;
  confidence: number | null;
  serialNumber: number | null;
  markedAt: string | null;
  student: { id: number; name: string; registrationNumber: string; photoUrl?: string } | null;
}

interface Session {
  id: number;
  courseId: number;
  slotCode: string;
  date: string;
  status: 'ONGOING' | 'FINALIZED';
}

type Step = 'setup' | 'session';

const JS_DAY_TO_TIMETABLE: Record<number, DayOfWeek | null> = {
  0: null,
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: null,
};

export function Attendance() {
  // ── Step 1: Setup ──
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isStarting, setIsStarting] = useState(false);
  const [setupError, setSetupError] = useState('');

  // ── Step 2: Session ──
  const [step, setStep] = useState<Step>('setup');
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeMsg, setFinalizeMsg] = useState('');
  const [isMarkingAllAbsent, setIsMarkingAllAbsent] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  // Sync and online status effect
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const { syncPendingMarks } = await import('../lib/syncService');
      const count = await syncPendingMarks();
      if (count > 0) {
        // Refresh session to get updated records from server
        if (session) await loadSession(session.id);
      }
      checkPending();
    };
    
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check and sync
    const checkPending = async () => {
      const { getPendingMarks } = await import('../lib/offlineQueue');
      const marks = await getPendingMarks();
      setPendingCount(marks.length);
    };
    checkPending();
    
    if (navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [session?.id]);

  useEffect(() => {
    fetchApi('/courses')
      .then(c => {
        setCourses(c);
        if (c.length > 0) setSelectedCourseId(String(c[0].id));
      })
      .catch(console.error);
  }, []);

  const activeCourse = courses.find(c => String(c.id) === selectedCourseId);
  const dayOfWeek: DayOfWeek | null = selectedDate
    ? (JS_DAY_TO_TIMETABLE[new Date(selectedDate + 'T00:00:00').getDay()] ?? null)
    : null;

  const activeBlocks = activeCourse && dayOfWeek
    ? getBlocksForPattern(activeCourse.slotPattern).filter(b => b.day === dayOfWeek)
    : [];

  const loadSession = async (sessionId: number) => {
    const data = await fetchApi(`/sessions/${sessionId}`);
    setSession(data.session);
    setRecords(data.records);
    setCourse(data.course);
  };

  const handleStartSession = async () => {
    if (!selectedCourseId || !selectedDate) { setSetupError('Please fill in all fields.'); return; }
    if (activeBlocks.length === 0) { setSetupError('This course has no classes scheduled on the selected date.'); return; }
    setIsStarting(true);
    setSetupError('');
    try {
      const slotCode = activeBlocks[0].code;
      const data = await fetchApi('/sessions', {
        method: 'POST',
        body: JSON.stringify({ courseId: parseInt(selectedCourseId), slotCode, date: selectedDate }),
      });
      await loadSession(data.session.id);
      setStep('session');
    } catch (err: any) {
      setSetupError(err.message || 'Failed to start session');
    } finally {
      setIsStarting(false);
    }
  };

  // Unified mark function — method can be 'MANUAL' or 'FACE'
  const markAttendance = async (
    studentId: number,
    status: 'PRESENT' | 'ABSENT' | 'NOT_MARKED',
    method: 'MANUAL' | 'FACE' = 'MANUAL',
    confidence?: number,
  ) => {
    if (!session) return;
    setMarkingId(studentId);
    try {
      const isOffline = !navigator.onLine;

      if (isOffline) {
        // Import dynamically to avoid top-level await issues if any
        const { queueMark } = await import('../lib/offlineQueue');
        await queueMark({
          sessionId: session.id,
          studentId,
          status,
          method,
          confidence: confidence ?? null,
          markedAt: new Date().toISOString(),
        });
        // Update local state immediately
        setRecords(prev => prev.map(r =>
          r.studentId === studentId
            ? { ...r, status, method, confidence: confidence ?? null, markedAt: new Date().toISOString() }
            : r,
        ));
        setPendingCount(prev => prev + 1);
      } else {
        await fetchApi(`/sessions/${session.id}/records/${studentId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status, method, confidence: confidence ?? null }),
        });
        setRecords(prev => prev.map(r =>
          r.studentId === studentId
            ? { ...r, status, method, confidence: confidence ?? null, markedAt: new Date().toISOString() }
            : r,
        ));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to mark attendance');
    } finally {
      setMarkingId(null);
    }
  };

  // Mark all still-unmarked students as ABSENT at once
  const handleMarkAllAbsent = async () => {
    if (!session) return;
    const unmarked = records.filter(r => r.status === 'NOT_MARKED');
    if (unmarked.length === 0) return;
    if (!confirm(`Mark ${unmarked.length} unmarked student(s) as ABSENT?`)) return;
    setIsMarkingAllAbsent(true);
    for (const r of unmarked) {
      await markAttendance(r.studentId, 'ABSENT', 'MANUAL');
    }
    setIsMarkingAllAbsent(false);
  };

  const handleFinalize = async () => {
    if (!session) return;
    if (!confirm('Finalize this session? All unmarked students will be marked ABSENT. No further changes will be allowed.')) return;
    setIsFinalizing(true);
    try {
      await fetchApi(`/sessions/${session.id}/finalize`, { method: 'POST' });
      setSession(prev => prev ? { ...prev, status: 'FINALIZED' } : prev);
      // Reflect finalization locally — NOT_MARKED → ABSENT
      setRecords(prev => prev.map(r =>
        r.status === 'NOT_MARKED' ? { ...r, status: 'ABSENT', markedAt: new Date().toISOString() } : r,
      ));
      setFinalizeMsg('Session finalized successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to finalize session');
    } finally {
      setIsFinalizing(false);
    }
  };

  const presentCount = records.filter(r => r.status === 'PRESENT').length;
  const absentCount  = records.filter(r => r.status === 'ABSENT').length;
  const unmarkedCount = records.filter(r => r.status === 'NOT_MARKED').length;
  const totalCount   = records.length;
  const markedPct    = totalCount > 0 ? Math.round(((presentCount + absentCount) / totalCount) * 100) : 0;
  const isFinalized  = session?.status === 'FINALIZED';

  // ── Setup Screen ──
  if (step === 'setup') {
    return (
      <div className="attendance-setup">
        <div className="page-header">
          <div>
            <h1>Daily Attendance</h1>
            <p>Select a date and course to begin an attendance session</p>
          </div>
        </div>

        <div className="setup-card glass-panel">
          <div className="setup-icon"><CalendarDays size={32} /></div>
          <h2>Start Attendance Session</h2>

          {setupError && <div className="error-alert">{setupError}</div>}

          {courses.length === 0 ? (
            <div className="empty-hint">No courses found. <a href="/register">Create a course first →</a></div>
          ) : (
            <div className="setup-form">
              <div className="form-group">
                <label htmlFor="att-date">Date</label>
                <input id="att-date" type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              </div>

              <div className="form-group">
                <label htmlFor="att-course">Course</label>
                <select id="att-course" value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name} ({c.slotPattern})</option>
                  ))}
                </select>
              </div>

              {activeCourse && dayOfWeek && (
                <div className="form-group">
                  <label>Classes on {dayOfWeek} ({selectedDate})</label>
                  {activeBlocks.length > 0 ? (
                    <div className="scheduled-blocks">
                      {activeBlocks.map((b, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99,102,241,0.08)', padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.9rem', color: 'var(--primary)' }}>
                          <Clock size={15} />
                          <strong>{b.code}</strong>
                          <span style={{ color: 'var(--text-secondary)' }}>{b.startTime} – {b.endTime}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      No classes scheduled on {dayOfWeek} for this course.
                    </div>
                  )}
                </div>
              )}

              <button
                className="btn btn-primary start-btn"
                onClick={handleStartSession}
                disabled={isStarting || activeBlocks.length === 0}
              >
                {isStarting ? 'Starting...' : <> Start Session <ChevronRight size={18} /></>}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Session Screen ──
  const sessionBlock = course && session
    ? getBlocksForPattern(course.slotPattern).find(b => b.code === session.slotCode)
    : null;

  return (
    <div className="attendance-session">
      {/* Header */}
      <div className="session-header page-header">
        <div>
          <h1>{course?.code} — {course?.name}</h1>
          <p>
            {session?.slotCode}
            {sessionBlock ? ` · ${sessionBlock.startTime}–${sessionBlock.endTime}` : ''}
            {` · ${session?.date}`}
            {isFinalized && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>Finalized</span>}
          </p>
        </div>
        <div className="session-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setStep('setup')}>← Back</button>
          {!isFinalized && (
            <button className="btn btn-primary" onClick={handleFinalize} disabled={isFinalizing}>
              <Lock size={16} />
              {isFinalizing ? 'Finalizing...' : 'Finalize Session'}
            </button>
          )}
        </div>
      </div>

      {finalizeMsg && <div className="success-alert">{finalizeMsg}</div>}

      <div className="session-body">
        {/* Offline & Sync Status Banner */}
        {(!isOnline || pendingCount > 0) && (
          <div style={{
            gridColumn: '1 / -1',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isOnline ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${isOnline ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isOnline ? 'var(--success)' : 'var(--danger)' }}>
              {!isOnline ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
              <strong>{!isOnline ? 'You are offline.' : 'Back online.'}</strong>
              <span>Attendance marks will be saved locally.</span>
            </div>
            {pendingCount > 0 && (
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {pendingCount} mark(s) pending sync...
              </span>
            )}
          </div>
        )}

        {/* ── Left: Student Attendance Grid ── */}
        <div className="attendance-panel">
          {/* Summary stats */}
          <div className="att-summary">
            <div className="att-stat present"><span>{presentCount}</span> Present</div>
            <div className="att-stat absent"><span>{absentCount}</span> Absent</div>
            <div className="att-stat unmarked"><span>{unmarkedCount}</span> Not Marked</div>
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                <span>{presentCount + absentCount} of {totalCount} marked</span>
                <span>{markedPct}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${markedPct}%`,
                  background: markedPct === 100 ? 'var(--success)' : 'var(--primary)',
                  borderRadius: 3,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          )}

          {/* Mark all absent shortcut */}
          {unmarkedCount > 0 && (
            <div style={{ marginBottom: '0.75rem', textAlign: 'right' }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleMarkAllAbsent}
                disabled={isMarkingAllAbsent}
                style={{ fontSize: '0.78rem' }}
              >
                <XCircle size={13} />
                {isMarkingAllAbsent ? 'Marking...' : `Mark ${unmarkedCount} remaining as Absent`}
              </button>
            </div>
          )}

          {records.length === 0 ? (
            <div className="empty-hint" style={{ padding: '2rem', textAlign: 'center' }}>
              No students enrolled in this course yet.
            </div>
          ) : (
            <div className="student-grid">
              {records.map((r) => (
                <div key={r.studentId} className={`student-card glass-panel status-${r.status.toLowerCase()}`}>
                  {/* Avatar: show photo if available, else initial */}
                  <div className="student-avatar" style={{ overflow: 'hidden', flexShrink: 0 }}>
                    {r.student?.photoUrl ? (
                      <img
                        src={r.student.photoUrl}
                        alt={r.student.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                      />
                    ) : (
                      r.student?.name.charAt(0).toUpperCase() ?? '?'
                    )}
                  </div>

                  <div className="student-info">
                    <span className="student-name">{r.student?.name ?? 'Unknown'}</span>
                    <span className="student-reg">{r.student?.registrationNumber}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem' }}>
                      {r.serialNumber && <span className="student-serial">#{r.serialNumber}</span>}
                      {/* Method badge */}
                      {r.method === 'FACE' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.65rem', background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                          <Scan size={9} /> FACE
                        </span>
                      )}
                      {r.method === 'MANUAL' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.65rem', background: 'rgba(148,163,184,0.15)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                          <UserCheck size={9} /> MANUAL
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="att-buttons">
                    <button
                      className={`btn btn-sm ${r.status === 'PRESENT' ? 'btn-success' : 'btn-secondary'}`}
                      onClick={() => markAttendance(r.studentId, r.status === 'PRESENT' ? 'NOT_MARKED' : 'PRESENT', 'MANUAL')}
                      disabled={markingId === r.studentId}
                      title={r.status === 'PRESENT' ? 'Undo Present' : 'Mark Present'}
                    >
                      <CheckCircle2 size={15} />
                    </button>
                    <button
                      className={`btn btn-sm ${r.status === 'ABSENT' ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => markAttendance(r.studentId, r.status === 'ABSENT' ? 'NOT_MARKED' : 'ABSENT', 'MANUAL')}
                      disabled={markingId === r.studentId}
                      title={r.status === 'ABSENT' ? 'Undo Absent' : 'Mark Absent'}
                    >
                      <XCircle size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Face Scanner ── */}
        <div className="camera-panel glass-panel">
          {session && (
            <FaceScanner
              sessionId={session.id}
              records={records}
              onMatch={(studentId) => markAttendance(studentId, 'PRESENT', 'FACE')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
