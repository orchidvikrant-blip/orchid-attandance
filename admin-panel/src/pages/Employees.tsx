import React, { useEffect, useRef, useState } from 'react';
import { getAllEmployees, addEmployee, deleteEmployee } from '../services/employeeService';
import type { Employee } from '../services/employeeService';
import toast from 'react-hot-toast';
import { registerFaceWithLuxand, deleteFaceFromLuxand } from '../utils/faceDescriptor';

const DEPARTMENTS = ['HR', 'IT', 'Finance', 'Operations', 'Sales', 'Admin', 'Management'];

const emptyForm = {
  name: '', employeeId: '', department: DEPARTMENTS[0],
  email: '', phone: '',
};

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [photoBase64, setPhotoBase64] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [captureMode, setCaptureMode] = useState<'upload' | 'camera'>('upload');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await getAllEmployees();
    setEmployees(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const captureFromCamera = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    const raw = canvas.toDataURL('image/jpeg', 0.9);
    const compressed = await compressImage(raw);
    setPhotoPreview(compressed);
    setPhotoBase64(compressed.split(',')[1]);
    stopCamera();
    setCaptureMode('upload');
  };

  const compressImage = (dataUrl: string): Promise<string> =>
    new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = dataUrl;
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const raw = ev.target?.result as string;
      const compressed = await compressImage(raw);
      setPhotoPreview(compressed);
      setPhotoBase64(compressed.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoBase64) { toast.error('Photo required'); return; }
    setSaving(true);
    try {
      const loadingId = 'luxand-reg';
      toast.loading('Registering face with Luxand...', { id: loadingId });
      const luxandPersonId = await registerFaceWithLuxand(form.name, photoPreview);
      toast.dismiss(loadingId);

      await addEmployee(
        { ...form, luxandPersonId },
        photoBase64
      );
      toast.success(`${form.name} registered! Face ID: ${luxandPersonId.slice(0, 8)}...`);
      setShowForm(false);
      setForm(emptyForm);
      setPhotoBase64('');
      setPhotoPreview('');
      await load();
    } catch (err: any) {
      toast.error('Registration failed: ' + (err?.message ?? 'Unknown error'));
    }
    setSaving(false);
  };

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`Delete ${emp.name}?`)) return;
    if (emp.luxandPersonId) await deleteFaceFromLuxand(emp.luxandPersonId);
    await deleteEmployee(emp.id);
    toast.success('Employee deleted');
    await load();
  };

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#a78bfa', fontSize: 28, fontWeight: 700 }}>Employees</h1>
          <p style={{ color: '#475569' }}>{employees.length} registered</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle('#6366f1')}>
          {showForm ? '✕ Cancel' : '+ Add Employee'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={cardStyle}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 20 }}>Register New Employee</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {([['name', 'Full Name'], ['employeeId', 'Employee ID'], ['email', 'Email'], ['phone', 'Phone']] as const).map(([key, label]) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    required
                    value={form[key as keyof typeof emptyForm]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    style={inputStyle}
                    type={key === 'email' ? 'email' : 'text'}
                  />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Department</label>
                <select
                  value={form.department}
                  onChange={e => setForm({ ...form, department: e.target.value })}
                  style={inputStyle}
                >
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {/* Photo capture */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Face Photo</label>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <button type="button" onClick={() => { setCaptureMode('upload'); stopCamera(); }} style={btnStyle(captureMode === 'upload' ? '#6366f1' : '#374151')}>
                  Upload File
                </button>
                <button type="button" onClick={() => { setCaptureMode('camera'); startCamera(); }} style={btnStyle(captureMode === 'camera' ? '#6366f1' : '#374151')}>
                  Use Camera
                </button>
              </div>

              {captureMode === 'upload' && (
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ color: '#94a3b8' }} />
              )}

              {captureMode === 'camera' && (
                <div>
                  <video ref={videoRef} autoPlay muted style={{ width: 280, height: 210, borderRadius: 8, background: '#000' }} />
                  <br />
                  <button type="button" onClick={captureFromCamera} style={{ ...btnStyle('#22c55e'), marginTop: 8 }}>
                    📸 Capture
                  </button>
                </div>
              )}

              {photoPreview && (
                <img src={photoPreview} alt="preview" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, marginTop: 10, border: '2px solid #6366f1' }} />
              )}
            </div>

            <button type="submit" disabled={saving} style={btnStyle('#22c55e')}>
              {saving ? 'Saving...' : 'Register Employee'}
            </button>
          </form>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          placeholder="Search by name, ID, or department..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, width: 320 }}
        />
      </div>

      {/* Employee grid */}
      {loading ? (
        <div style={{ color: '#94a3b8' }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {filtered.map(emp => (
            <div key={emp.id} style={cardStyle}>
              <img
                src={emp.photoBase64 ? `data:image/jpeg;base64,${emp.photoBase64}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=6366f1&color=fff`}
                alt={emp.name}
                style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }}
              />
              <div style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>{emp.name}</div>
              <div style={{ color: '#a78bfa', fontSize: 13, marginTop: 2 }}>{emp.employeeId}</div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{emp.department}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => handleDelete(emp)}
                  style={{ ...btnStyle('#7f1d1d'), fontSize: 12, padding: '6px 12px' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ color: '#475569', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>
              No employees found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const btnStyle = (bg: string) => ({
  background: bg, color: '#fff', border: 'none', borderRadius: 8,
  padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
});
const inputStyle: React.CSSProperties = {
  background: '#0f0f1a', border: '1px solid #2d2d4e', borderRadius: 8,
  padding: '10px 14px', color: '#e2e8f0', fontSize: 14, width: '100%',
  boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6,
};
const cardStyle: React.CSSProperties = {
  background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 12, padding: 20, marginBottom: 20,
};
