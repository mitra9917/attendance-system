import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  LogOut, ClipboardList, UserPlus, Menu, Eye,
} from 'lucide-react';
import './Layout.css';

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/attendance', icon: <ClipboardList size={20} />, label: 'Daily Attendance' },
    { to: '/register', icon: <UserPlus size={20} />, label: 'Register' },
    { to: '/view', icon: <Eye size={20} />, label: 'View' },
  ];

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="layout">
      <div className="mobile-topbar">
        <button className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
        <div className="logo-inline">
          <span className="logo-icon">S</span>
          <span>Smart Attendance</span>
        </div>
        <div className="user-avatar user-avatar--sm">{user?.name.charAt(0).toUpperCase()}</div>
      </div>

      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">S</span>
            <h2>Smart Attendance</h2>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={closeSidebar}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.name.charAt(0).toUpperCase()}</div>
            <div className="user-details">
              <span className="user-name">{user?.name}</span>
              <span className={`user-role badge ${user?.role === 'ADMIN' ? 'badge-warning' : 'badge-success'}`}>
                {user?.role}
              </span>
            </div>
          </div>
          <button className="btn btn-secondary logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="main-blob main-blob--tl" aria-hidden="true" />
        <div className="main-blob main-blob--br" aria-hidden="true" />

        <div className="content-wrapper animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
