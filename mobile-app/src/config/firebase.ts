import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

// TODO: Replace with your Firebase project config from https://console.firebase.google.com
const firebaseConfig = {
  apiKey: "AIzaSyBailGGywmg3UQc8JxB99qZdGoY2IcuAq0",
  authDomain: "orchid-attendance.firebaseapp.com",
  projectId: "orchid-attendance",
  storageBucket: "orchid-attendance.firebasestorage.app",
  messagingSenderId: "1029897329624",
  appId: "1:1029897329624:web:dd24de194b113274de30ad",
  measurementId: "G-5NFSQZ0FFB"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export default app;
