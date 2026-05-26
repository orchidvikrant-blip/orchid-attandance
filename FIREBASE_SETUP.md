# Firebase Setup Guide — Orchid Attendance

## Step 1: Firebase Project Banao

1. https://console.firebase.google.com par jao
2. "Add project" click karo
3. Project name: `orchid-attendance`
4. Continue → Continue → Create project

## Step 2: Firestore Database Setup

1. Left sidebar mein "Firestore Database" click karo
2. "Create database" → "Start in test mode" → Next → Enable
3. Rules tab mein ye paste karo (production ke liye):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /employees/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /attendance/{doc} {
      allow read, write: if true;
    }
  }
}
```

## Step 3: Storage Setup

1. Left sidebar mein "Storage" click karo
2. "Get started" → "Start in test mode" → Done

## Step 4: Web App Register Karo

1. Project Overview → Web icon (</>)
2. App nickname: `orchid-web`
3. Register app
4. **Firebase config copy karo** (ye aayega):

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## Step 5: Config Files Update Karo

Ye config **dono jagah** paste karo:

1. `mobile-app/src/config/firebase.ts`
2. `admin-panel/src/config/firebase.ts`

---

# Indexes (Attendance queries ke liye)

Firestore Console → Indexes tab → Add index:

| Collection | Field 1 | Field 2 | Field 3 |
|-----------|---------|---------|---------|
| attendance | employeeId (Asc) | date (Asc) | timestamp (Asc) |

---

# Collections Structure

## `employees` collection:
```json
{
  "name": "Rahul Sharma",
  "employeeId": "EMP001",
  "department": "IT",
  "email": "rahul@company.com",
  "phone": "9876543210",
  "faceDescriptor": [0.1, 0.2, ...],
  "photoUrl": "https://storage.googleapis.com/...",
  "createdAt": Timestamp
}
```

## `attendance` collection:
```json
{
  "employeeId": "doc_id_from_employees",
  "employeeName": "Rahul Sharma",
  "type": "IN",
  "timestamp": Timestamp,
  "date": "2026-05-26"
}
```
