import React, { useState } from 'react';
import { getAllAttendance, getAllEmployees } from '../services/employeeService';
import type { AttendanceRecord, Employee } from '../services/employeeService';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState('');

  const fetchData = async () => {
    const [records, employees] = await Promise.all([
      getAllAttendance(dateFrom, dateTo),
      getAllEmployees(),
    ]);
    return { records, employees };
  };

  const buildSummary = (records: AttendanceRecord[], employees: Employee[]) => {
    const dates = new Set(records.map(r => r.date));
    return employees.map(emp => {
      const empRecords = records.filter(r => r.employeeId === emp.id);
      const daysPresent = new Set(empRecords.filter(r => r.type === 'IN').map(r => r.date)).size;
      const totalDays = dates.size;

      // Calculate hours worked per day
      let totalMinutes = 0;
      Array.from(dates).forEach(date => {
        const dayRecs = empRecords.filter(r => r.date === date).sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);
        for (let i = 0; i < dayRecs.length - 1; i += 2) {
          const inRec = dayRecs[i];
          const outRec = dayRecs[i + 1];
          if (inRec?.type === 'IN' && outRec?.type === 'OUT') {
            totalMinutes += (outRec.timestamp.seconds - inRec.timestamp.seconds) / 60;
          }
        }
      });

      const hours = Math.floor(totalMinutes / 60);
      const mins = Math.round(totalMinutes % 60);

      return {
        Name: emp.name,
        'Employee ID': emp.employeeId,
        Department: emp.department,
        'Days Present': daysPresent,
        'Total Working Days': totalDays,
        'Attendance %': totalDays > 0 ? ((daysPresent / totalDays) * 100).toFixed(1) + '%' : '0%',
        'Total Hours': `${hours}h ${mins}m`,
      };
    });
  };

  const downloadExcel = async () => {
    setGenerating(true);
    const { records, employees } = await fetchData();

    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summary = buildSummary(records, employees);
    const ws1 = XLSX.utils.json_to_sheet(summary);
    ws1['!cols'] = [{ wch: 25 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    // Detailed log sheet
    const detailedRows = records.map(r => ({
      Name: r.employeeName,
      Date: r.date,
      Time: r.timestamp?.toDate?.()?.toLocaleTimeString('en-IN') || '',
      Type: r.type,
    }));
    const ws2 = XLSX.utils.json_to_sheet(detailedRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Detailed Log');

    XLSX.writeFile(wb, `orchid-attendance-${dateFrom}-to-${dateTo}.xlsx`);
    setLastGenerated('Excel');
    setGenerating(false);
  };

  const downloadPDF = async () => {
    setGenerating(true);
    const { records, employees } = await fetchData();
    const summary = buildSummary(records, employees);

    const doc = new jsPDF({ orientation: 'landscape' });

    // Header
    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, 297, 30, 'F');
    doc.setTextColor(167, 139, 250);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('🌸 Orchid Attendance Report', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Period: ${dateFrom} to ${dateTo}`, 200, 18);

    // Summary table
    doc.setFontSize(12);
    doc.setTextColor(226, 232, 240);
    doc.text('Employee Summary', 14, 42);

    autoTable(doc, {
      startY: 46,
      head: [Object.keys(summary[0] || {})],
      body: summary.map(Object.values),
      styles: { fillColor: [15, 15, 26], textColor: [226, 232, 240], fontSize: 9 },
      headStyles: { fillColor: [45, 45, 78], textColor: [167, 139, 250], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [26, 26, 46] },
    });

    doc.save(`orchid-attendance-${dateFrom}-to-${dateTo}.pdf`);
    setLastGenerated('PDF');
    setGenerating(false);
  };

  return (
    <div>
      <h1 style={{ color: '#a78bfa', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Reports</h1>
      <p style={{ color: '#475569', marginBottom: 32 }}>Download attendance reports in Excel or PDF format</p>

      <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 28, border: '1px solid #2d2d4e', maxWidth: 500 }}>
        <h3 style={{ color: '#e2e8f0', marginBottom: 20 }}>Select Date Range</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
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
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={downloadExcel}
            disabled={generating}
            style={{ background: '#166534', color: '#22c55e', border: '1px solid #22c55e', borderRadius: 8, padding: '12px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 14, flex: 1 }}
          >
            {generating && lastGenerated === '' ? '...' : '📊 Download Excel'}
          </button>
          <button
            onClick={downloadPDF}
            disabled={generating}
            style={{ background: '#7f1d1d', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 14, flex: 1 }}
          >
            {generating && lastGenerated === '' ? '...' : '📄 Download PDF'}
          </button>
        </div>

        {lastGenerated && !generating && (
          <p style={{ color: '#22c55e', fontSize: 13, marginTop: 16, textAlign: 'center' }}>
            ✓ {lastGenerated} downloaded successfully!
          </p>
        )}
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 32 }}>
        {[
          { icon: '📊', title: 'Excel Report', desc: 'Summary + detailed log. Open in Excel or Google Sheets. Easy to filter and analyze.' },
          { icon: '📄', title: 'PDF Report', desc: 'Formatted report with company branding. Ready to print or share with management.' },
          { icon: '📋', title: 'What\'s Included', desc: 'Employee-wise summary, daily IN/OUT times, total hours worked, attendance percentage.' },
        ].map(card => (
          <div key={card.title} style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #2d2d4e' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{card.icon}</div>
            <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 8 }}>{card.title}</div>
            <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>{card.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#0f0f1a', border: '1px solid #2d2d4e', borderRadius: 8,
  padding: '10px 14px', color: '#e2e8f0', fontSize: 14, width: '100%', boxSizing: 'border-box',
};
