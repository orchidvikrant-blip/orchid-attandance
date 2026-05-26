import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: '📊 Dashboard', end: true },
  { to: '/employees', label: '👥 Employees' },
  { to: '/attendance', label: '📋 Attendance' },
  { to: '/reports', label: '📁 Reports' },
];

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#071022', color: '#e8edf5' }}>
      {/* Sidebar */}
      <aside style={{
        width: 250,
        background: '#0a1628',
        borderRight: '1px solid #1e3a78',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 0 24px',
        flexShrink: 0,
      }}>
        {/* Logo area */}
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid #1e3a78',
          background: '#0f1f3d',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}>
          <img
            src="/logo.png"
            alt="Orchid Logo"
            style={{ width: 140, objectFit: 'contain', filter: 'brightness(1.05)' }}
          />
          <div style={{
            fontSize: 11,
            color: '#e8a820',
            letterSpacing: 2,
            fontWeight: 600,
            textTransform: 'uppercase',
          }}>
            Attendance System
          </div>
        </div>

        <nav style={{ flex: 1, paddingTop: 12 }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                padding: '13px 24px',
                color: isActive ? '#e8a820' : '#8fa8d4',
                textDecoration: 'none',
                fontWeight: isActive ? 600 : 400,
                background: isActive ? '#0f1f3d' : 'transparent',
                borderLeft: isActive ? '3px solid #e8a820' : '3px solid transparent',
                fontSize: 14,
                transition: 'all 0.15s',
                gap: 10,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #1e3a78' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#22c55e' }} />
            <span style={{ fontSize: 12, color: '#4a6fa5' }}>System Active</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        <Outlet />
      </main>
    </div>
  );
}
