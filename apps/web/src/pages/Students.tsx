import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { Modal } from '../components/Modal';

interface Student {
  id: number;
  registrationNumber: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
  isActive: boolean;
}

export function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  
  // Form state
  const [regNo, setRegNo] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadStudents = async () => {
    try {
      const data = await fetchApi('/students');
      setStudents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const handleOpenModal = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setRegNo(student.registrationNumber);
      setName(student.name);
      setEmail(student.email || '');
      setPhotoUrl(student.photoUrl || '');
    } else {
      setEditingStudent(null);
      setRegNo('');
      setName('');
      setEmail('');
      setPhotoUrl('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingStudent) {
        await fetchApi(`/students/${editingStudent.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, email }),
        });
      } else {
        await fetchApi('/students', {
          method: 'POST',
          body: JSON.stringify({ registrationNumber: regNo, name, email, photoUrl: photoUrl || undefined }),
        });
      }
      setIsModalOpen(false);
      loadStudents();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this student?')) return;
    try {
      await fetchApi(`/students/${id}`, { method: 'DELETE' });
      loadStudents();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Students</h1>
          <p>Manage enrolled students</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} /> Add Student
        </button>
      </div>

      {error && <div className="error-alert">{error}</div>}

      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Reg. Number</th>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>No students found</td></tr>
            ) : (
              students.map((student) => (
                <tr key={student.id}>
                  <td style={{ fontFamily: 'monospace' }}>{student.registrationNumber}</td>
                  <td style={{ fontWeight: 500 }}>{student.name}</td>
                  <td>{student.email || '-'}</td>
                  <td>
                    <span className={`badge ${student.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {student.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button className="icon-btn" onClick={() => navigate(`/students/${student.id}/enroll`)} title="Enroll Face" style={{ color: 'var(--primary)' }}>
                        <Camera size={16} />
                      </button>
                      <button className="icon-btn" onClick={() => handleOpenModal(student)} title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button className="icon-btn" onClick={() => handleDelete(student.id)} title="Delete" style={{ color: 'var(--danger)' }}>
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

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingStudent ? 'Edit Student' : 'Add New Student'}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label>Registration Number</label>
            <input 
              value={regNo} 
              onChange={e => setRegNo(e.target.value)} 
              disabled={!!editingStudent} 
              required 
            />
          </div>
          <div className="form-group">
            <label>Full Name</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label>Email (Optional)</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
            />
          </div>
          <div className="form-group">
            <label>Photo URL (Optional)</label>
            <input 
              value={photoUrl} 
              onChange={e => setPhotoUrl(e.target.value)} 
              placeholder="URL to student photo"
            />
          </div>
          
          <div className="modal-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Student'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
