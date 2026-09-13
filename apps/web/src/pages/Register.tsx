import React, { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../lib/api';
import { BookOpen, UserPlus, GraduationCap, List, Trash2 } from 'lucide-react';
import './Register.css';

interface Course { id: number; code: string; name: string; slotId: number; slot?: { name: string; startTime: string; endTime: string; } | null }
interface Slot { id: number; name: string; startTime: string; endTime: string; }
interface Student { id: number; registrationNumber: string; name: string; email: string | null; isActive: boolean; }

type Tab = 'course' | 'student' | 'manage-courses' | 'manage-students';

export function Register() {
  const [activeTab, setActiveTab] = useState<Tab>('course');

  return (
    <div className="register-page">
      <div className="page-header">
        <div>
          <h1>Register</h1>
          <p>Create courses, register students, and manage existing records</p>
        </div>
      </div>

      <div className="register-tabs">
        <button className={`tab-btn ${activeTab === 'course' ? 'active' : ''}`} onClick={() => setActiveTab('course')}>
          <BookOpen size={18} /> Register Course
        </button>
        <button className={`tab-btn ${activeTab === 'student' ? 'active' : ''}`} onClick={() => setActiveTab('student')}>
          <UserPlus size={18} /> Register Student
        </button>
        <button className={`tab-btn ${activeTab === 'manage-courses' ? 'active' : ''}`} onClick={() => setActiveTab('manage-courses')}>
          <List size={18} /> Manage Courses
        </button>
        <button className={`tab-btn ${activeTab === 'manage-students' ? 'active' : ''}`} onClick={() => setActiveTab('manage-students')}>
          <GraduationCap size={18} /> Manage Students
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'course' && <RegisterCourse />}
        {activeTab === 'student' && <RegisterStudent />}
        {activeTab === 'manage-courses' && <ManageCourses />}
        {activeTab === 'manage-students' && <ManageStudents />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Register Course Tab
// ─────────────────────────────────────────
function RegisterCourse() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [slotId, setSlotId] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchApi('/slots')
      .then(data => {
        setSlots(data);
        if (data.length > 0) setSlotId(String(data[0].id));
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotId) {
      setMessage({ type: 'error', text: 'Please select a slot.' });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const course = await fetchApi('/courses', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim().toUpperCase(), name: name.trim(), slotId: parseInt(slotId) }),
      });
      const slotName = slots.find(s => String(s.id) === slotId)?.name ?? '';
      setMessage({ type: 'success', text: `Course "${course.code} — ${course.name}" (${slotName}) created successfully!` });
      setCode('');
      setName('');
      if (slots.length > 0) setSlotId(String(slots[0].id));
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create course' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="register-panel glass-panel">
      <div className="panel-header">
        <div className="panel-icon"><BookOpen size={22} /></div>
        <div>
          <h2>Create New Course</h2>
          <p>Add a subject/course with its time slot to the system</p>
        </div>
      </div>

      {message && <div className={message.type === 'success' ? 'success-alert' : 'error-alert'}>{message.text}</div>}

      {slots.length === 0 && (
        <div className="error-alert" style={{ marginBottom: '1rem' }}>
          ⚠️ No slots available. Please contact admin to create time slots first.
        </div>
      )}

      <form onSubmit={handleSubmit} className="register-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="course-code">Course Code *</label>
            <input id="course-code" value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. CS101" required />
          </div>
          <div className="form-group">
            <label htmlFor="course-slot">Slot *</label>
            {slots.length === 0 ? (
              <select id="course-slot" disabled><option>No slots available</option></select>
            ) : (
              <select id="course-slot" value={slotId} onChange={e => setSlotId(e.target.value)} required>
                {slots.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.startTime} – {s.endTime})</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="course-name">Course Name *</label>
          <input id="course-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Introduction to Computer Science" required />
        </div>

        <button type="submit" className="btn btn-primary submit-btn" disabled={isSubmitting || slots.length === 0}>
          {isSubmitting ? 'Creating...' : 'Create Course'}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────
// Register Student Tab
// ─────────────────────────────────────────
function RegisterStudent() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [enrollInCourse, setEnrollInCourse] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchApi('/courses')
      .then(data => {
        setCourses(data);
        if (data.length > 0) setSelectedCourseId(String(data[0].id));
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      let student;
      try {
        student = await fetchApi('/students', {
          method: 'POST',
          body: JSON.stringify({
            registrationNumber: regNo.trim(),
            name: name.trim(),
            email: email.trim() || undefined,
            photoUrl: photoUrl.trim() || undefined,
          }),
        });
      } catch (err: any) {
        if (err.message?.includes('already exists')) {
          throw new Error(`Registration number "${regNo}" already exists.`);
        }
        throw err;
      }

      if (enrollInCourse && selectedCourseId) {
        try {
          await fetchApi('/enrollments', {
            method: 'POST',
            body: JSON.stringify({ studentId: student.id, courseId: parseInt(selectedCourseId) }),
          });
          const course = courses.find(c => String(c.id) === selectedCourseId);
          const courseName = course ? `${course.code} — ${course.name}` : selectedCourseId;
          setMessage({ type: 'success', text: `Student "${student.name}" registered and enrolled in ${courseName}!` });
        } catch (err: any) {
          if (err.message?.includes('already enrolled')) {
            setMessage({ type: 'success', text: `Student "${student.name}" registered. Note: Already enrolled in this course.` });
          } else {
            throw err;
          }
        }
      } else {
        setMessage({ type: 'success', text: `Student "${student.name}" registered successfully!` });
      }

      setName(''); setRegNo(''); setEmail(''); setPhotoUrl('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Registration failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="register-panel glass-panel">
      <div className="panel-header">
        <div className="panel-icon"><UserPlus size={22} /></div>
        <div>
          <h2>Register New Student</h2>
          <p>Add a student and optionally enroll them in a course</p>
        </div>
      </div>

      {message && <div className={message.type === 'success' ? 'success-alert' : 'error-alert'}>{message.text}</div>}

      <form onSubmit={handleSubmit} className="register-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="stu-name">Full Name *</label>
            <input id="stu-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Doe" required />
          </div>
          <div className="form-group">
            <label htmlFor="stu-reg">Registration Number *</label>
            <input id="stu-reg" value={regNo} onChange={e => setRegNo(e.target.value)} placeholder="e.g. 2024CS001" required />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="stu-email">Email (Optional)</label>
          <input id="stu-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="student@example.com" />
        </div>

        <div className="form-group">
          <label htmlFor="stu-photo">Photo URL (Optional)</label>
          <input id="stu-photo" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="URL to student photo" />
        </div>

        <div className="enroll-section glass-panel" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', padding: '1rem' }}>
          <label className="checkbox-label">
            <input type="checkbox" checked={enrollInCourse} onChange={e => setEnrollInCourse(e.target.checked)} style={{ width: 'auto', marginRight: '0.5rem' }} />
            Enroll this student in a course
          </label>

          {enrollInCourse && (
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label htmlFor="enroll-course">Select Course</label>
              {courses.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No courses available. <a href="/register">Create a course first.</a>
                </p>
              ) : (
                <select id="enroll-course" value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}{c.slot ? ` (${c.slot.name})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Registering...' : 'Register Student'}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────
// Manage Courses Tab
// ─────────────────────────────────────────
function ManageCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadCourses = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchApi('/courses');
      setCourses(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load courses');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  const handleDelete = async (id: number, code: string) => {
    if (!confirm(`Delete course "${code}" and all its enrollments/sessions? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await fetchApi(`/courses/${id}`, { method: 'DELETE' });
      setCourses(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete course');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="register-panel glass-panel">
      <div className="panel-header">
        <div className="panel-icon"><List size={22} /></div>
        <div>
          <h2>Manage Courses</h2>
          <p>View and delete existing courses</p>
        </div>
      </div>

      {error && <div className="error-alert">{error}</div>}

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Loading...</p>
      ) : courses.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>No courses found. Create one using the "Register Course" tab.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Slot</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map(course => (
                <tr key={course.id}>
                  <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{course.code}</td>
                  <td>{course.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {course.slot ? `${course.slot.name} (${course.slot.startTime}–${course.slot.endTime})` : `Slot #${course.slotId}`}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="icon-btn"
                      onClick={() => handleDelete(course.id, course.code)}
                      disabled={deletingId === course.id}
                      style={{ color: 'var(--danger)' }}
                      title="Delete course"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Manage Students Tab
// ─────────────────────────────────────────
function ManageStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchApi('/students');
      setStudents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete student "${name}" and all their enrollment/attendance records? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await fetchApi(`/students/${id}`, { method: 'DELETE' });
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete student');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="register-panel glass-panel">
      <div className="panel-header">
        <div className="panel-icon"><GraduationCap size={22} /></div>
        <div>
          <h2>Manage Students</h2>
          <p>View and delete registered students</p>
        </div>
      </div>

      {error && <div className="error-alert">{error}</div>}

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Loading...</p>
      ) : students.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>No students found. Register one using the "Register Student" tab.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Reg. No.</th>
                <th>Name</th>
                <th>Email</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{student.registrationNumber}</td>
                  <td style={{ fontWeight: 500 }}>{student.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{student.email || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="icon-btn"
                      onClick={() => handleDelete(student.id, student.name)}
                      disabled={deletingId === student.id}
                      style={{ color: 'var(--danger)' }}
                      title="Delete student"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
