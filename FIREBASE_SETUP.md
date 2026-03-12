# Firebase Integration Guide for TimePK WeaponLogg

## 📋 Quick Start

This document guides you through setting up Firebase for cloud syncing your weapon logg data.

## Step 1: Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Create Project"**
3. Enter project name: `timepk-weaponlogg`
4. Accept default settings, click **Create**
5. Wait for project to initialize

## Step 2: Add Firebase Web App

1. In Firebase Console, click the **gear icon** → **Project Settings**
2. Go to **"Your apps"** section
3. Click **Web icon** (</>)
4. Register app with name: `TimePK WeaponLogg`
5. Copy the `firebaseConfig` object (you'll need this next)

## Step 3: Configure firebase-config.js

1. Open `firebase-config.js` in your editor
2. Replace the `firebaseConfig` object with your actual Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
```

## Step 4: Enable Firestore Database

1. In Firebase Console, go to **Build** → **Firestore Database**
2. Click **Create Database**
3. Choose **production mode**
4. Select **your region** (choose closest to you, e.g., `europe-west1`)
5. Click **Create**

### Firestore Security Rules

In Firestore Console, go to **Rules** tab and replace with:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Click **Publish**. This ensures only authenticated users can access your data.

## Step 5: Enable Google Authentication

1. In Firebase Console, go to **Build** → **Authentication**
2. Click **Get Started**
3. Click **Google** provider
4. Enable it and set up OAuth consent:
   - Choose **External** for User Type
   - Fill in required fields
   - Add test user emails (your club members' Google accounts)
5. Click **Save and Continue**

## Step 6: Migrate Your Data

### Option A: Using the App's Import Feature (Recommended)

1. In the old app (localStorage version), click **Admin** → **Eksporter data**
2. Copy the entire JSON to clipboard
3. In the new Firebase version, log in with Google
4. Go to **Admin** section → paste JSON in textarea
5. Click **Importer data**
6. Data is now in cloud!

### Option B: Manual Firestore Import

If you want to import directly to Firestore:

1. Export data from old app to JSON file
2. Go to Firestore Console
3. For each collection (medlemmer, vapen, utlaan, skyteledere):
   - Click **"Start Collection"**
   - Enter collection name
   - Add documents manually or use a script

## Step 7: Test Multi-User Sync

1. Open the app in two browsers/devices with different Google accounts
2. Add a new member in one app
3. Check if it appears instantly in the other app
4. Test adding weapons, loans, etc.

## Files Created/Modified

### New Files:
- `firebase-config.js` - Firebase credentials
- `firebase-auth.js` - Google login/logout
- `firebase-db.js` - Firestore database operations

### Modified Files:
- `index.html` - Added login screen and logout button
- `app.js` - Refactored for Firebase (see IMPORTANT note below)

## IMPORTANT: app.js Changes

The new `app.js` is **module-based** and uses ES6 imports:

```html
<!-- In index.html, change script tag to: -->
<script type="module" src="app.js"></script>
```

Key changes in app.js:
- `localStorage` → Firebase Firestore
- `db.load()` → `fbDb.getCollection()`
- `persist()` → `persistToFirebase()` (now async)
- Real-time syncing with `setupRealtimeSync()`
- All write operations are async and immediately update cloud

## Troubleshooting

### "CORS Error" or "Unauthorized"
- Check that Google Auth is enabled
- Verify your email is in the test users list
- Check Firestore security rules

### "Cannot find module"
- Ensure all three Firebase JS files are in the same directory as `index.html`
- Verify CDN links are correct in firebase-config.js

### Data not syncing
- Check browser console (F12) for errors
- Ensure you're logged in
- Check that Firestore database has data (go to console)
- Verify security rules allow your user

## Offline Support

Firebase automatically caches data offline. Users can:
- View cached data when offline
- Make changes (queued)
- Sync automatically when connection restored

Service Worker (`sw.js`) still works alongside Firebase for PWA features.

## Next Steps

1. Test thoroughly with multiple users
2. Backup your data regularly (use Export feature)
3. Add club members' Google accounts as test users
4. Train club members to use the new login system
5. Set up automatic backups (optional Firebase Cloud Storage)

## Support

For Firebase issues, see: https://firebase.google.com/docs/firestore
