import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { fetchApi } from '../lib/api';
import { Modal } from '../components/Modal';

interface Slot {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
}

export function Slots() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSlots = async () => {
    try {
      const data = await fetchApi('/slots');
      setSlots(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load slots');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, []);

  const handleOpenModal = () => {
    setName('');
    setStartTime('09:00');
    setEndTime('10:00');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetchApi('/slots', {
        method: 'POST',
        body: JSON.stringify({ name, startTime, endTime }),
      });
      setIsModalOpen(false);
      loadSlots();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this slot?')) return;
    try {
      await fetchApi(`/slots/${id}`, { method: 'DELETE' });
      loadSlots();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Time Slots</h1>
          <p>Manage daily schedule blocks</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <Plus size={18} /> Add Slot
        </button>
      </div>

      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : slots.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center' }}>No slots found</td></tr>
            ) : (
              slots.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.startTime}</td>
                  <td>{s.endTime}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="icon-btn" onClick={() => handleDelete(s.id)} style={{ color: 'var(--danger)' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Time Slot">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label>Slot Name (e.g., Morning A)</label>
            <input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>End Time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
            </div>
          </div>
          
          <div className="modal-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Slot'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
