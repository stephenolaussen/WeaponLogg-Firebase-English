# WeaponLog (V6.24) - Firebase Edition

## Overview
WeaponLog is spesialy made for a shooting club's. It is a web-based application designed to help Range Officer efficiently track and manage all of the things a Range Officer needs to manage at the firerange regarding the firearms.

This app now features Firebase integration for multi-user access and real-time data synchronization across devices.

This app features a modern user interface, offline support, cloud synchronization, and is optimized for both desktop and mobile devices.

## Password: Admin You can now change the PW in the Red Admin button!
## Features
 - Weapon tracking and management
 - Firebase authentication with Google Sign-In
 - Multi-user access with real-time data synchronization
 - Cloud data storage with offline fallback
 - Responsive design for desktop and mobile
 - Progressive Web App (PWA) support (installable, offline functionality)
 - User-friendly interface
 - Some features are password locked and you will need to change password yourself. (PW: WeaponLog)
 - Approve deviations (avvik) with password and optional comment for traceability
 - CSV logg for tracking faults and fix for weapon
 - CSV logg for gun cleaning
 - Added weapon counter and aktiv status: yes (green) and no (red)
 - Added stamp deviation alert

## Firebase Integration
The app now uses Firebase for:
 - User authentication via Google Sign-In
 - Real-time data synchronization between users
 - Cloud storage
 - Multi-device access to shared data
## Deviation Approval (Avvik)

When approving a deviation (avvik), the responsible person must enter a password and can add a comment to the approval. The comment is stored and shown in the log for traceability.
## Getting Started

### Online Version (Recommended)
Visit the live app at: 

1. Click "Logg inn med Google"
2. Sign in with your Google account
3. Start managing weapons and rentals

### Local Development

1. **Clone the repository:**
   ```
   git clone <repository-url>
   ```
2. **Open the project folder:**
   Open the folder in your preferred code editor.

3. **Change icons:** 
   Update icons to the same size and name to your preference

4. **Run locally:**
   Start a local HTTP server (required for Firebase):
   ```
   Then open `http://localhost:8000` in your browser.

## Project Structure
- `app.js` - Main JavaScript logic with Firebase integration
- `index.html` - Main HTML file with authentication UI
- `style.css` - Stylesheet
- `firebase-config.js` - Firebase project configuration
- `firebase-auth.js` - Firebase authentication module
- `firebase-db.js` - Firebase Firestore database module
- `manifest.json` - PWA manifest
- `sw.js` - Service worker for offline support
- `assets/` - Icons and screenshots

## Screenshots
Screenshots are available in the `assets/screenshots/` folder.

## License
This project is licensed under the MIT License.

## Author
[Stephen Olaussen]
//updated 12.03.2026 - Firebase integration
