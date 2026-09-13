import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { CalendarDays, ChevronRight, CheckCircle2, XCircle, Lock, Clock } from 'lucide-react';
import { getBlocksForPattern } from '@attendance/shared';
import type { DayOfWeek } from '@attendance/shared';
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
  0: null,       // SUN — no classes
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: null,       // SAT — no classes
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

  useEffect(() => {
    fetchApi('/courses')
      .then(c => {
        setCourses(c);
        if (c.length > 0) setSelectedCourseId(String(c[0].id));
      })
      .catch(console.error);
  }, []);

  // Compute the day of the selected date
  const activeCourse = courses.find(c => String(c.id) === selectedCourseId);
  const dayOfWeek: DayOfWeek | null = selectedDate
    ? (JS_DAY_TO_TIMETABLE[new Date(selectedDate + 'T00:00:00').getDay()] ?? null)
    : null;

  // Find all blocks scheduled for this course on the selected day
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
    if (!selectedCourseId || !selectedDate) {
      setSetupError('Please fill in all fields.');
      return;
    }
    if (activeBlocks.length === 0) {
      setSetupError('This course has no classes scheduled on the selected date.');
      return;
    }

    setIsStarting(true);
    setSetupError('');
    try {
      // Use the first block's code as the session's slotCode
      const slotCode = activeBlocks[0].code;
      const data = await fetchApi('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          courseId: parseInt(selectedCourseId),
          slotCode,
          date: selectedDate,
        }),
      });
      await loadSession(data.session.id);
      setStep('session');
    } catch (err: any) {
      setSetupError(err.message || 'Failed to start session');
    } finally {
      setIsStarting(false);
    }
  };

  const markAttendance = async (studentId: number, status: 'PRESENT' | 'ABSENT' | 'NOT_MARKED') => {
    if (!session || session.status === 'FINALIZED') return;
    setMarkingId(studentId);
    try {
      await fetchApi(`/sessions/${session.id}/records/${studentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, method: 'MANUAL' }),
      });
      setRecords(prev => prev.map(r =>
        r.studentId === studentId ? { ...r, status, method: 'MANUAL', markedAt: new Date().toISOString() } : r
      ));
    } catch (err: any) {
      alert(err.message || 'Failed to mark attendance');
    } finally {
      setMarkingId(null);
    }
  };

  const handleFinalize = async () => {
    if (!session) return;
    if (!confirm('Finalize this session? No further changes will be allowed.')) return;
    setIsFinalizing(true);
    try {
      await fetchApi(`/sessions/${session.id}/finalize`, { method: 'POST' });
      setSession(prev => prev ? { ...prev, status: 'FINALIZED' } : prev);
      setFinalizeMsg('Session finalized successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to finalize session');
    } finally {
      setIsFinalizing(false);
    }
  };

  const presentCount = records.filter(r => r.status === 'PRESENT').length;
  const absentCount = records.filter(r => r.status === 'ABSENT').length;
  const unmarkedCount = records.filter(r => r.status === 'NOT_MARKED').length;
  const isFinalized = session?.status === 'FINALIZED';

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
          <div className="setup-icon">
            <CalendarDays size={32} />
          </div>
          <h2>Start Attendance Session</h2>

          {setupError && <div className="error-alert">{setupError}</div>}

          {courses.length === 0 ? (
            <div className="empty-hint">
              No courses found. <a href="/register">Create a course first →</a>
            </div>
          ) : (
            <div className="setup-form">
              <div className="form-group">
                <label htmlFor="att-date">Date</label>
                <input
                  id="att-date"
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="att-course">Course</label>
                <select
                  id="att-course"
                  value={selectedCourseId}
                  onChange={e => setSelectedCourseId(e.target.value)}
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name} ({c.slotPattern})
                    </option>
                  ))}
                </select>
              </div>

              {/* Show schedule info for selected date */}
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

  // ── Step 2: Session Screen ──
  const sessionBlock = course && session ? getBlocksForPattern(course.slotPattern).find(b => b.code === session.slotCode) : null;

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
        {/* ── Left: Student Attendance Grid ── */}
        <div className="attendance-panel">
          <div className="att-summary">
            <div className="att-stat present"><span>{presentCount}</span> Present</div>
            <div className="att-stat absent"><span>{absentCount}</span> Absent</div>
            <div className="att-stat unmarked"><span>{unmarkedCount}</span> Not Marked</div>
          </div>

          {records.length === 0 ? (
            <div className="empty-hint" style={{ padding: '2rem', textAlign: 'center' }}>
              No students enrolled in this course yet.
            </div>
          ) : (
            <div className="student-grid">
              {records.map((r) => (
                <div key={r.studentId} className={`student-card glass-panel status-${r.status.toLowerCase()}`}>
                  <div className="student-avatar">
                    {r.student?.name.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div className="student-info">
                    <span className="student-name">{r.student?.name ?? 'Unknown'}</span>
                    <span className="student-reg">{r.student?.registrationNumber}</span>
                    {r.serialNumber && <span className="student-serial">#{r.serialNumber}</span>}
                  </div>
                  {!isFinalized ? (
                    <div className="att-buttons">
                      <button
                        className={`btn btn-sm ${r.status === 'PRESENT' ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => markAttendance(r.studentId, r.status === 'PRESENT' ? 'NOT_MARKED' : 'PRESENT')}
                        disabled={markingId === r.studentId}
                        title="Mark Present"
                      >
                        <CheckCircle2 size={15} />
                      </button>
                      <button
                        className={`btn btn-sm ${r.status === 'ABSENT' ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={() => markAttendance(r.studentId, r.status === 'ABSENT' ? 'NOT_MARKED' : 'ABSENT')}
                        disabled={markingId === r.studentId}
                        title="Mark Absent"
                      >
                        <XCircle size={15} />
                      </button>
                    </div>
                  ) : (
                    <span className={`badge ${r.status === 'PRESENT' ? 'badge-success' : r.status === 'ABSENT' ? 'badge-danger' : 'badge-neutral'}`}>
                      {r.status === 'NOT_MARKED' ? 'N/M' : r.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Camera Placeholder ── */}
        <div className="camera-panel glass-panel">
          <div className="camera-placeholder">
            <div className="camera-icon">📷</div>
            <h3>Face Recognition</h3>
            <p>Camera & face recognition will be integrated in a future phase.</p>
            <div className="camera-hint">
              For now, use the <strong>Present / Absent</strong> buttons to mark attendance manually.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
