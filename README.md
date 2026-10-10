# BlackSquad Mobility

Ride booking and live fleet tracking for customers, drivers and fleet owners.

| Folder | What it is |
| --- | --- |
| `backend/` | Node.js + Express + Socket.IO API, MongoDB via Mongoose |
| `frontend/` | Expo (React Native) app for Android, iOS and web; app code lives in `frontend/src` |
| `.github/workflows/` | `ci.yml` runs checks and tests; `android-preview.yml` builds a signed pilot APK |

## Run it locally

You need Node 22 and a local MongoDB.

```bash
# Backend
cd backend
cp .env.example .env        # set JWT_SECRET to 32+ random characters
npm ci
npm run dev                 # http://localhost:5000/api/health

# App
cd frontend
cp .env.example .env        # point EXPO_PUBLIC_API_BASE_URL at your backend
npm ci
npm start                   # then press a (Android), i (iOS) or w (web)
```

On macOS, port 5000 is often taken by AirPlay Receiver. Set `PORT=5001` in `backend/.env` and use the same port in `frontend/.env`.

On a phone, `localhost` is the phone itself: use your computer's LAN address instead.

## Checks

```bash
cd backend  && npx tsc --noEmit && npm run lint && npm run build
cd backend  && MONGODB_URI=mongodb://127.0.0.1:27017/blacksquad_test npm test
cd frontend && npm run typecheck && npm run lint && npx expo-doctor
```

The backend test suite deletes and creates records, so it refuses to run unless the database name contains `test`.

## Release signing

Signing keys are never committed. A release build reads the upload key from these environment variables or Gradle properties:

- `BLACKSQUAD_UPLOAD_STORE_FILE`
- `BLACKSQUAD_UPLOAD_STORE_PASSWORD`
- `BLACKSQUAD_UPLOAD_KEY_ALIAS`
- `BLACKSQUAD_UPLOAD_KEY_PASSWORD`

The APK workflow takes them from repository secrets (`ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD`). The server URL and Google client IDs come from repository variables (`EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`).
