import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { Eye, Search, CheckCircle, XCircle, Clock, Download } from 'lucide-react';
import { exportToCsv } from '../lib/exportUtils';
import './View.css';

interface Slot { id: string; name: string; startTime: string; endTime: string; }
interface Course { id: number; code: string; name: string; slotPattern: string; }
interface AttendanceRecord {
  id: number;
  studentId: number;
  status: 'PRESENT' | 'ABSENT' | 'NOT_MARKED';
  method: string | null;
  markedAt: string | null;
  serialNumber: number | null;
  student: {
    id: number;
    name: string;
    registrationNumber: string;
    photoUrl: string | null;
  } | null;
}
interface SessionDetail {
  session: { id: number; date: string; status: string; startedAt: string; finalizedAt: string | null; };
  course: { id: number; code: string; name: string; } | null;
  slot: { id: string; name: string; startTime: string; endTime: string; } | null;
  records: AttendanceRecord[];
}

export function View() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    fetchApi('/courses')
      .then((c) => {
        setCourses(c);
        if (c.length > 0) {
          setSelectedCourseId(String(c[0].id));
        }
      })
      .catch(console.error);
  }, []);

  // Compute ALL available slots for the selected course (all days, deduped by code)
  useEffect(() => {
    const fetchBlocks = async () => {
      const course = courses.find(c => String(c.id) === selectedCourseId);
      if (course && course.slotPattern) {
        const { getBlocksForPattern } = await import('@attendance/shared');
        const blocks = getBlocksForPattern(course.slotPattern);
        // Deduplicate by code — same slot code can appear on multiple days
        const seen = new Set<string>();
        const uniqueBlocks = blocks.filter(b => {
          if (seen.has(b.code)) return false;
          seen.add(b.code);
          return true;
        });
        const slotList = uniqueBlocks.map((b: any) => ({
          id: b.code,
          name: b.code,
          startTime: b.startTime,
          endTime: b.endTime,
        }));
        setSlots(slotList);
        if (slotList.length > 0 && !slotList.find(s => s.id === selectedSlotId)) {
          setSelectedSlotId(slotList[0].id);
        }
      } else {
        setSlots([]);
      }
    };
    fetchBlocks();
  }, [selectedCourseId, courses]);

  // When course changes, reset session
  const handleCourseChange = (id: string) => {
    setSelectedCourseId(id);
    setSessionDetail(null);
    setHasSearched(false);
  };

  const handleSearch = async () => {
    if (!selectedCourseId || !selectedSlotId || !selectedDate) return;
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setSessionDetail(null);

    try {
      // Find the session for this course/slot/date
      const sessions = await fetchApi(
        `/sessions?courseId=${selectedCourseId}&slotCode=${selectedSlotId}&date=${selectedDate}`
      );
      if (!sessions || sessions.length === 0) {
        setSessionDetail(null);
        setIsLoading(false);
        return;
      }
      // Fetch full session detail with records
      const detail = await fetchApi(`/sessions/${sessions[0].id}`);
      setSessionDetail(detail);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch attendance data');
    } finally {
      setIsLoading(false);
    }
  };

  const presentCount = sessionDetail?.records.filter(r => r.status === 'PRESENT').length ?? 0;
  const absentCount = sessionDetail?.records.filter(r => r.status === 'ABSENT').length ?? 0;
  const notMarkedCount = sessionDetail?.records.filter(r => r.status === 'NOT_MARKED').length ?? 0;
  const totalCount = sessionDetail?.records.length ?? 0;
  const attendancePercent = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  const handleExportCsv = () => {
    if (!sessionDetail) return;
    exportToCsv(
      sessionDetail.records,
      sessionDetail.session.date,
      sessionDetail.course?.code || 'Unknown'
    );
  };

  return (
    <div className="view-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>View Attendance</h1>
          <p>Select a course, slot, and date to view attendance records</p>
        </div>
        {sessionDetail && (
          <button className="btn btn-secondary" onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={16} /> Export CSV
          </button>
        )}
      </div>

      {/* Filter Panel */}
      <div className="view-filter-panel glass-panel">
        <div className="filter-grid">
          <div className="form-group">
            <label htmlFor="view-course">Course</label>
            {courses.length === 0 ? (
              <select id="view-course" disabled><option>No courses available</option></select>
            ) : (
              <select id="view-course" value={selectedCourseId} onChange={e => handleCourseChange(e.target.value)}>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="view-slot">Slot</label>
            {slots.length === 0 ? (
              <select id="view-slot" disabled><option>No slots available</option></select>
            ) : (
              <select id="view-slot" value={selectedSlotId} onChange={e => { setSelectedSlotId(e.target.value); setSessionDetail(null); setHasSearched(false); }}>
                {slots.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.startTime} – {s.endTime})</option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="view-date">Date</label>
            <input
              id="view-date"
              type="date"
              value={selectedDate}
              onChange={e => { setSelectedDate(e.target.value); setSessionDetail(null); setHasSearched(false); }}
            />
          </div>

          <div className="form-group search-btn-group">
            <label>&nbsp;</label>
            <button
              className="btn btn-primary"
              onClick={handleSearch}
              disabled={isLoading || !selectedCourseId || !selectedSlotId || !selectedDate}
            >
              <Search size={16} />
              {isLoading ? 'Loading...' : 'View Attendance'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && <div className="error-alert">{error}</div>}

      {/* No session found */}
      {hasSearched && !isLoading && !sessionDetail && !error && (
        <div className="no-session glass-panel">
          <Eye size={48} strokeWidth={1} />
          <h3>No attendance session found</h3>
          <p>No session was started for this course, slot, and date combination.</p>
        </div>
      )}

      {/* Session Detail */}
      {sessionDetail && (
        <>
          {/* Stats */}
          <div className="view-stats">
            <div className="stat-card glass-panel present-card">
              <CheckCircle size={28} />
              <div>
                <span className="stat-number">{presentCount}</span>
                <span className="stat-label">Present</span>
              </div>
            </div>
            <div className="stat-card glass-panel absent-card">
              <XCircle size={28} />
              <div>
                <span className="stat-number">{absentCount}</span>
                <span className="stat-label">Absent</span>
              </div>
            </div>
            <div className="stat-card glass-panel pending-card">
              <Clock size={28} />
              <div>
                <span className="stat-number">{notMarkedCount}</span>
                <span className="stat-label">Not Marked</span>
              </div>
            </div>
            <div className="stat-card glass-panel percent-card">
              <div className="percent-ring">
                <span>{attendancePercent}%</span>
              </div>
              <div>
                <span className="stat-number">{totalCount}</span>
                <span className="stat-label">Total Students</span>
              </div>
            </div>
          </div>

          {/* Session info bar */}
          <div className="session-info-bar glass-panel">
            <span>
              <strong>{sessionDetail.course?.code} — {sessionDetail.course?.name}</strong>
            </span>
            <span>🕐 {sessionDetail.slot?.name} ({sessionDetail.slot?.startTime} – {sessionDetail.slot?.endTime})</span>
            <span>📅 {sessionDetail.session.date}</span>
            <span className={`badge ${sessionDetail.session.status === 'FINALIZED' ? 'badge-success' : 'badge-warning'}`}>
              {sessionDetail.session.status}
            </span>
          </div>

          {/* Attendance Table */}
          {sessionDetail.records.length === 0 ? (
            <div className="no-session glass-panel">
              <p>No students enrolled in this course.</p>
            </div>
          ) : (
            <div className="attendance-table-wrapper glass-panel">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Reg. No.</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Method</th>
                    <th>Marked At</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionDetail.records.map(record => (
                    <tr key={record.id} className={`status-row status-${record.status.toLowerCase().replace('_', '-')}`}>
                      <td className="serial-col">{record.serialNumber ?? '—'}</td>
                      <td className="reg-col">{record.student?.registrationNumber ?? '—'}</td>
                      <td className="name-col">
                        {record.student?.photoUrl ? (
                          <img src={record.student.photoUrl} alt="" className="student-thumb" />
                        ) : (
                          <span className="student-avatar-sm">{record.student?.name?.charAt(0).toUpperCase() ?? '?'}</span>
                        )}
                        {record.student?.name ?? '—'}
                      </td>
                      <td>
                        <span className={`status-badge status-badge-${record.status.toLowerCase().replace('_', '-')}`}>
                          {record.status === 'PRESENT' && <CheckCircle size={13} />}
                          {record.status === 'ABSENT' && <XCircle size={13} />}
                          {record.status === 'NOT_MARKED' && <Clock size={13} />}
                          {record.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="method-col">{record.method ?? '—'}</td>
                      <td className="time-col">
                        {record.markedAt
                          ? new Date(record.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
