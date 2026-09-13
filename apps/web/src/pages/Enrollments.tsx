import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { fetchApi } from '../lib/api';
import { Modal } from '../components/Modal';

interface Enrollment {
  id: number;
  course: { id: number; code: string; name: string };
  student: { id: number; registrationNumber: string; name: string };
  serialNumber: number;
}

export function Enrollments() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<{id: number, code: string}[]>([]);
  const [students, setStudents] = useState<{id: number, registrationNumber: string, name: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [eData, cData, sData] = await Promise.all([
        fetchApi('/enrollments'),
        fetchApi('/courses'),
        fetchApi('/students'),
      ]);
      setEnrollments(eData);
      setCourses(cData);
      setStudents(sData);
    } catch (err: any) {
      alert(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = () => {
    setCourseId(courses[0]?.id.toString() || '');
    setStudentId(students[0]?.id.toString() || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetchApi('/enrollments', {
        method: 'POST',
        body: JSON.stringify({ 
          courseId: parseInt(courseId), 
          studentId: parseInt(studentId) 
        }),
      });
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this enrollment?')) return;
    try {
      await fetchApi(`/enrollments/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Enrollments</h1>
          <p>Manage student course assignments</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <Plus size={18} /> Enroll Student
        </button>
      </div>

      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Student Reg</th>
              <th>Student Name</th>
              <th>Serial</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : enrollments.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>No enrollments found</td></tr>
            ) : (
              enrollments.map((enr) => (
                <tr key={enr.id}>
                  <td style={{ fontWeight: 600 }}>{enr.course.code}</td>
                  <td>{enr.student.registrationNumber}</td>
                  <td>{enr.student.name}</td>
                  <td>{enr.serialNumber}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="icon-btn" onClick={() => handleDelete(enr.id)} style={{ color: 'var(--danger)' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Enroll Student">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label>Course</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)} required>
              {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Student</label>
            <select value={studentId} onChange={e => setStudentId(e.target.value)} required>
              {students.map(s => <option key={s.id} value={s.id}>{s.registrationNumber} - {s.name}</option>)}
            </select>
          </div>
          
          <div className="modal-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Enroll'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
