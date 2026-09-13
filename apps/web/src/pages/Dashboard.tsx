import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { fetchApi } from '../lib/api';
import { BookOpen, GraduationCap, CalendarCheck, UserCheck } from 'lucide-react';
import './Dashboard.css';

interface Stats {
  courses: number;
  students: number;
  sessionsToday: number;
  presentToday: number;
}

export function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchApi('/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const cards = [
    { icon: <BookOpen size={24} />, label: 'Active Courses', value: stats?.courses ?? 0, color: 'indigo' },
    { icon: <GraduationCap size={24} />, label: 'Registered Students', value: stats?.students ?? 0, color: 'violet' },
    { icon: <CalendarCheck size={24} />, label: 'Sessions Today', value: stats?.sessionsToday ?? 0, color: 'cyan' },
    { icon: <UserCheck size={24} />, label: 'Present Today', value: stats?.presentToday ?? 0, color: 'green' },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-welcome">
        <h1>Welcome back, {user?.name.split(' ')[0]} 👋</h1>
        <p>Here's what's happening in your attendance system today.</p>
      </div>

      <div className="stats-grid">
        {cards.map((card) => (
          <div key={card.label} className={`stat-card glass-panel color-${card.color}`}>
            <div className="stat-icon">{card.icon}</div>
            <div className="stat-body">
              <div className="stat-value">
                {isLoading ? <span className="stat-skeleton" /> : card.value}
              </div>
              <div className="stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-hint glass-panel">
        <h3>Quick Start</h3>
        <ol>
          <li>Go to <strong>Register</strong> → <em>Register Course</em> to create a course and link it to a time slot.</li>
          <li>Go to <strong>Register</strong> → <em>Register Student</em> to add a student and enroll them in a course.</li>
          <li>Use <strong>Daily Attendance</strong> to start a session and mark student attendance.</li>
          <li>Use <strong>View</strong> to review attendance records for any course, slot, and date.</li>
        </ol>
      </div>
    </div>
  );
}
