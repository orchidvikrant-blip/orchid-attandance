import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Employee {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  faceDescriptor: number[];
  photoBase64: string;
  createdAt: Timestamp;
}

export interface AttendanceRecord {
  id?: string;
  employeeId: string;
  employeeName: string;
  type: 'IN' | 'OUT';
  timestamp: Timestamp;
  date: string;
}

export async function getAllEmployees(): Promise<Employee[]> {
  const snapshot = await getDocs(collection(db, 'employees'));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
}

export async function markAttendance(
  employee: Employee,
  type: 'IN' | 'OUT'
): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const record: Omit<AttendanceRecord, 'id'> = {
    employeeId: employee.id,
    employeeName: employee.name,
    type,
    timestamp: Timestamp.fromDate(now),
    date: dateStr,
  };

  const docRef = await addDoc(collection(db, 'attendance'), record);
  return docRef.id;
}

export async function getTodayAttendance(employeeId: string): Promise<AttendanceRecord[]> {
  const today = new Date().toISOString().split('T')[0];
  const q = query(
    collection(db, 'attendance'),
    where('employeeId', '==', employeeId),
    where('date', '==', today),
    orderBy('timestamp', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
}

export async function getLastAttendanceType(employeeId: string): Promise<'IN' | 'OUT' | null> {
  const records = await getTodayAttendance(employeeId);
  if (records.length === 0) return null;
  return records[records.length - 1].type;
}
