# 🌸 Orchid Attendance

Face recognition-based attendance system for reception kiosk.

## Project Structure

```
Orchid Attedence app/
├── mobile-app/        Android kiosk app (Expo + React Native)
├── admin-panel/       Web admin panel (React + Vite)
└── FIREBASE_SETUP.md  Firebase configuration guide
```

---

## Mobile App (Kiosk) — Chalane ka tarika

### Prerequisites
- Node.js 18+
- Expo Go app Android phone/tablet par, ya
- Android Studio (emulator ke liye)

### Setup

```bash
cd mobile-app

# Firebase config update karo
# mobile-app/src/config/firebase.ts mein apna config paste karo

# Run karo
npx expo start --android
```

### Kaise kaam karta hai
1. App open hoga — camera front-facing dikhegi
2. Employee camera ke saamne aata hai
3. App automatically face detect karta hai har 2.5 seconds mein
4. Registered face match hone par **IN/OUT** automatically mark hoti hai
5. Green = IN marked, Orange = OUT marked

---

## Admin Panel — Chalane ka tarika

```bash
cd admin-panel

# Firebase config update karo
# admin-panel/src/config/firebase.ts mein apna config paste karo

npm run dev
# http://localhost:5173 par khulega
```

### Features
| Page | Kya karta hai |
|------|--------------|
| Dashboard | Aaj ki attendance, department chart, recent logs |
| Employees | Employee register/delete, face photo upload |
| Attendance | Date-wise attendance records filter |
| Reports | Excel + PDF download |

### Employee Register Karna (Pehla kadam!)
1. Admin Panel → Employees → "+ Add Employee"
2. Naam, ID, department, email, phone bharo
3. **Face photo upload karo** (clear, front-facing photo)
4. "Register Employee" click karo
5. Ab ye employee kiosk par recognize hoga

---

## Firebase Setup

`FIREBASE_SETUP.md` file padho — step by step guide hai.

---

## Face Recognition — Kaise kaam karta hai

- **BlazeFace** model (TensorFlow.js) face detect karta hai
- Face ke landmarks (aankhein, naak, munh) se ek unique descriptor banata hai
- Registered employees ke descriptors se compare karta hai
- **Cosine similarity** >= 0.92 hone par match consider kiya jaata hai
- Agar koi match nahi → "Chehra pehchana nahi gaya" message

### Accuracy badhane ke liye:
- Admin panel mein clear, well-lit, front-facing photo upload karo
- Kiosk tablet/phone ko fixed position par rakho
- Good lighting chahiye reception par

---

## Tech Stack

| Part | Technology |
|------|-----------|
| Android App | React Native + Expo SDK 56 |
| Face Detection | TensorFlow.js + BlazeFace |
| Web Admin | React + Vite + TypeScript |
| Database | Firebase Firestore |
| File Storage | Firebase Storage |
| Charts | Recharts |
| Excel Export | SheetJS (xlsx) |
| PDF Export | jsPDF + AutoTable |
