import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Employee {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  email: string;
  phone: string;
  luxandPersonId?: string;
  faceDescriptor?: number[];
  photoBase64: string;
  createdAt: Timestamp;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'IN' | 'OUT';
  timestamp: Timestamp;
  date: string;
}

export async function getAllEmployees(): Promise<Employee[]> {
  const snap = await getDocs(collection(db, 'employees'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
}

export async function addEmployee(
  data: Omit<Employee, 'id' | 'createdAt' | 'photoBase64'>,
  photoBase64: string
): Promise<string> {
  const docRef = await addDoc(collection(db, 'employees'), {
    ...data,
    photoBase64,
    faceDescriptor: [],
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateEmployee(id: string, data: Partial<Employee>): Promise<void> {
  await updateDoc(doc(db, 'employees', id), data as Record<string, unknown>);
}

export async function deleteEmployee(id: string): Promise<void> {
  await deleteDoc(doc(db, 'employees', id));
}

export async function getAllAttendance(dateFrom?: string, dateTo?: string): Promise<AttendanceRecord[]> {
  const snap = await getDocs(collection(db, 'attendance'));
  let records = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));

  if (dateFrom) records = records.filter(r => r.date >= dateFrom);
  if (dateTo) records = records.filter(r => r.date <= dateTo);

  return records.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
}
