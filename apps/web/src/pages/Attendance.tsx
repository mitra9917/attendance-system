import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { CalendarDays, ChevronRight, CheckCircle2, XCircle, Minus, Lock } from 'lucide-react';
import './Attendance.css';

interface Course { id: number; code: string; name: string; slotId: number; slot?: { id: number; name: string; startTime: string; endTime: string; } | null; }
interface Slot { id: number; name: string; startTime: string; endTime: string; }

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
  slotId: number;
  date: string;
  status: 'ONGOING' | 'FINALIZED';
}

type Step = 'setup' | 'session';

export function Attendance() {
  // ── Step 1: Setup ──
  const [courses, setCourses] = useState<Course[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isStarting, setIsStarting] = useState(false);
  const [setupError, setSetupError] = useState('');

  // ── Step 2: Session ──
  const [step, setStep] = useState<Step>('setup');
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeMsg, setFinalizeMsg] = useState('');

  useEffect(() => {
    Promise.all([fetchApi('/courses'), fetchApi('/slots')])
      .then(([c, s]) => {
        setCourses(c);
        setSlots(s);
        if (c.length > 0) {
          setSelectedCourseId(String(c[0].id));
          // Auto-select the slot linked to the first course
          setSelectedSlotId(String(c[0].slotId));
        } else if (s.length > 0) {
          setSelectedSlotId(String(s[0].id));
        }
      })
      .catch(console.error);
  }, []);

  // When course changes, auto-select its linked slot
  const handleCourseChange = (id: string) => {
    setSelectedCourseId(id);
    const course = courses.find(c => String(c.id) === id);
    if (course) setSelectedSlotId(String(course.slotId));
  };

  const loadSession = async (sessionId: number) => {
    const data = await fetchApi(`/sessions/${sessionId}`);
    setSession(data.session);
    setRecords(data.records);
    setCourse(data.course);
    setSlot(data.slot);
  };

  const handleStartSession = async () => {
    if (!selectedCourseId || !selectedSlotId || !selectedDate) {
      setSetupError('Please fill in all fields.');
      return;
    }
    setIsStarting(true);
    setSetupError('');
    try {
      const data = await fetchApi('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          courseId: parseInt(selectedCourseId),
          slotId: parseInt(selectedSlotId),
          date: selectedDate,
        }),
      });
      // Backend returns { session, existing } for both new (201) and found (200) sessions
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
            <p>Select date, course, and slot to begin a session</p>
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
          ) : slots.length === 0 ? (
            <div className="empty-hint">
              No slots found. <a href="/slots">Create a time slot first →</a>
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
                  onChange={e => handleCourseChange(e.target.value)}
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}{c.slot ? ` (${c.slot.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="att-slot">Time Slot</label>
                <select
                  id="att-slot"
                  value={selectedSlotId}
                  onChange={e => setSelectedSlotId(e.target.value)}
                >
                  {slots.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.startTime} – {s.endTime})</option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn-primary start-btn"
                onClick={handleStartSession}
                disabled={isStarting}
              >
                {isStarting ? 'Starting...' : <>Start Session <ChevronRight size={18} /></>}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Step 2: Session Screen ──
  return (
    <div className="attendance-session">
      {/* Header */}
      <div className="session-header page-header">
        <div>
          <h1>{course?.code} — {course?.name}</h1>
          <p>
            {slot?.name} · {slot?.startTime}–{slot?.endTime} · {session?.date}
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
          {/* Summary row */}
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
