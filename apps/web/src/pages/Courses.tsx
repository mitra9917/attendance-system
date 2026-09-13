import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { fetchApi } from '../lib/api';
import { Modal } from '../components/Modal';

interface Course {
  id: number;
  code: string;
  name: string;
  section: string;
  isActive: boolean;
}

export function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  
  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCourses = async () => {
    try {
      const data = await fetchApi('/courses');
      setCourses(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load courses');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleOpenModal = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setCode(course.code);
      setName(course.name);
      setSection(course.section);
    } else {
      setEditingCourse(null);
      setCode('');
      setName('');
      setSection('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingCourse) {
        await fetchApi(`/courses/${editingCourse.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, section }),
        });
      } else {
        await fetchApi('/courses', {
          method: 'POST',
          body: JSON.stringify({ code, name, section }),
        });
      }
      setIsModalOpen(false);
      loadCourses();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this course?')) return;
    try {
      await fetchApi(`/courses/${id}`, { method: 'DELETE' });
      loadCourses();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Courses</h1>
          <p>Manage subject sections</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} /> Add Course
        </button>
      </div>

      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Section</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : courses.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>No courses found</td></tr>
            ) : (
              courses.map((course) => (
                <tr key={course.id}>
                  <td style={{ fontWeight: 600 }}>{course.code}</td>
                  <td>{course.name}</td>
                  <td>{course.section}</td>
                  <td>
                    <span className={`badge ${course.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {course.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button className="icon-btn" onClick={() => handleOpenModal(course)} title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button className="icon-btn" onClick={() => handleDelete(course.id)} title="Delete" style={{ color: 'var(--danger)' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCourse ? 'Edit Course' : 'Add New Course'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label>Course Code</label>
            <input value={code} onChange={e => setCode(e.target.value)} disabled={!!editingCourse} required placeholder="e.g. CS101" />
          </div>
          <div className="form-group">
            <label>Course Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Intro to CS" />
          </div>
          <div className="form-group">
            <label>Section</label>
            <input value={section} onChange={e => setSection(e.target.value)} required placeholder="e.g. A" />
          </div>
          
          <div className="modal-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Course'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
