import React, { useEffect, useState } from 'react';
import { getAllAttendance, getAllEmployees } from '../services/employeeService';
import type { AttendanceRecord, Employee } from '../services/employeeService';

export default function Attendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [filterEmp, setFilterEmp] = useState('');

  const load = async () => {
    setLoading(true);
    const [recs, emps] = await Promise.all([
      getAllAttendance(dateFrom, dateTo),
      getAllEmployees(),
    ]);
    setRecords(recs);
    setEmployees(emps);
    setLoading(false);
  };

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  const filtered = records.filter(r =>
    filterEmp ? r.employeeId === filterEmp : true
  );

  const formatTime = (rec: AttendanceRecord) => {
    try {
      return rec.timestamp.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div>
      <h1 style={{ color: '#a78bfa', fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Attendance Log</h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {[['From', dateFrom, setDateFrom], ['To', dateTo, setDateTo]].map(([label, val, setter]) => (
          <div key={label as string}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>{label as string}</label>
            <input
              type="date"
              value={val as string}
              onChange={e => (setter as (v: string) => void)(e.target.value)}
              style={inputStyle}
            />
          </div>
        ))}
        <div>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Employee</label>
          <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} style={inputStyle}>
            <option value="">All Employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <button onClick={load} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          Refresh
        </button>
      </div>

      <div style={{ color: '#475569', marginBottom: 16, fontSize: 13 }}>
        {filtered.length} records found
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: '#94a3b8' }}>Loading...</div>
      ) : (
        <div style={{ background: '#1a1a2e', borderRadius: 12, border: '1px solid #2d2d4e', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0f0f1a' }}>
                {['Employee', 'Date', 'Time', 'Type', 'Status'].map(h => (
                  <th key={h} style={{ padding: '14px 18px', textAlign: 'left', color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec, i) => (
                <tr key={rec.id} style={{ borderTop: '1px solid #1e293b', background: i % 2 ? '#1a1a2e' : 'transparent' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{rec.employeeName}</div>
                  </td>
                  <td style={tdStyle}>{rec.date}</td>
                  <td style={tdStyle}>{formatTime(rec)}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: rec.type === 'IN' ? '#166534' : '#92400e',
                      color: rec.type === 'IN' ? '#22c55e' : '#f59e0b',
                    }}>
                      {rec.type}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 12, color: '#22c55e' }}>✓ Recorded</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#475569' }}>No records found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#0f0f1a', border: '1px solid #2d2d4e', borderRadius: 8,
  padding: '10px 14px', color: '#e2e8f0', fontSize: 14,
};
const tdStyle: React.CSSProperties = {
  padding: '14px 18px', color: '#e2e8f0', fontSize: 14,
};
