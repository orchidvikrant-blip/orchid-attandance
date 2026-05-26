import { useEffect, useState } from 'react';
import { getAllEmployees, getAllAttendance } from '../services/employeeService';
import type { Employee, AttendanceRecord } from '../services/employeeService';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip,
} from 'recharts';

const COLORS = ['#22c55e', '#e8a820', '#1e3a78', '#ef4444'];

interface StatsCard {
  label: string;
  value: string | number;
  color: string;
  icon: string;
}

export default function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    (async () => {
      const [emps, att] = await Promise.all([
        getAllEmployees(),
        getAllAttendance(today, today),
      ]);
      setEmployees(emps);
      setAttendance(att);
      setLoading(false);
    })();
  }, []);

  const todayIns = attendance.filter(a => a.type === 'IN');
  const presentIds = new Set(todayIns.map(a => a.employeeId));
  const absentCount = employees.length - presentIds.size;

  const stats: StatsCard[] = [
    { label: 'Total Employees', value: employees.length, color: '#6366f1', icon: '👥' },
    { label: 'Present Today', value: presentIds.size, color: '#22c55e', icon: '✅' },
    { label: 'Absent Today', value: absentCount, color: '#ef4444', icon: '❌' },
    { label: 'Total Scans Today', value: attendance.length, color: '#f59e0b', icon: '🔍' },
  ];

  const deptData = employees.reduce((acc, emp) => {
    acc[emp.department] = (acc[emp.department] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const pieData = Object.entries(deptData).map(([name, value]) => ({ name, value }));

  if (loading) return <div style={{ color: '#8fa8d4' }}>Loading dashboard...</div>;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#e8a820', fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: '#4a6fa5' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: '#0a1628',
            border: `1px solid ${s.color}44`,
            borderRadius: 12,
            padding: 20,
            borderTop: `3px solid ${s.color}`,
          }}>
            <div style={{ fontSize: 26, marginBottom: 10 }}>{s.icon}</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#4a6fa5', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Department pie chart */}
        <div style={{ background: '#0a1628', borderRadius: 12, padding: 24, border: '1px solid #1e3a78' }}>
          <h3 style={{ color: '#e8a820', marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Department Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0a1628', border: '1px solid #1e3a78', color: '#e8edf5' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Recent attendance */}
        <div style={{ background: '#0a1628', borderRadius: 12, padding: 24, border: '1px solid #1e3a78' }}>
          <h3 style={{ color: '#e8a820', marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Recent Attendance</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {attendance.slice(0, 6).map(rec => (
              <div key={rec.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: '#071022', borderRadius: 8,
                border: '1px solid #1e3a7833',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#e8edf5' }}>{rec.employeeName}</div>
                  <div style={{ color: '#4a6fa5', fontSize: 12 }}>
                    {rec.timestamp?.toDate?.()?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) || ''}
                  </div>
                </div>
                <span style={{
                  padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: rec.type === 'IN' ? '#166534' : '#7c3200',
                  color: rec.type === 'IN' ? '#22c55e' : '#e8a820',
                }}>
                  {rec.type}
                </span>
              </div>
            ))}
            {attendance.length === 0 && (
              <div style={{ color: '#4a6fa5', textAlign: 'center', padding: 20 }}>No records today</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
