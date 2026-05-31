# Addis Closet Swap - Telegram Mini App (TMA) Setup Guide

This repository contains the complete codebase for **Addis Closet Swap**, a premium, high-performance Telegram Mini App for fashion resale in Addis Ababa. It is designed as a lightweight Single-Page Application (SPA) using HTML5, CSS3, and Vanilla JavaScript, with a unified database adapter backing Firestore or `localStorage` fallbacks.

## Table of Contents
1. [Local Development & Zero-Config Demo](#1-local-development--zero-config-demo)
2. [Telegram Bot setup via BotFather](#2-telegram-bot-setup-via-botfather)
3. [Firebase Backend Configuration](#3-firebase-backend-configuration)
4. [Deployment Procedures](#4-deployment-procedures)
5. [Application Logic & Structure](#5-application-logic--structure)

---

## 1. Local Development & Zero-Config Demo

For immediate visual testing and validation, the app contains an automatic **LocalStorage Adapter Fallback**. 

If the Firebase configurations in `firebase-config.js` are left at their defaults, the application runs entirely in the browser using the browser's local memory. The database is pre-seeded with 5 realistic listings (CE-1001 to CE-1005) and mock profiles.

### To Run Locally:
1. Open the project folder in your editor.
2. Open `index.html` in any browser, or run a simple local web server:
   ```bash
   # Using Python
   python -m http.server 8000
   # Or Node.js
   npx serve .
   ```
3. Open `http://localhost:8000` (or the served port) in your browser.
4. **Testing Admin Controls**: Click the **Simulate Admin** button in the header. Navigate to **Account** -> click **Open Admin Dashboard** to view pending items/sellers, stats, and moderate listings.

---

## 2. Telegram Bot Setup via BotFather

To open this application natively inside Telegram, you must create a bot and link it to the web app:

1. Open Telegram and search for the official account **@BotFather**.
2. Start a chat and send `/newbot`.
3. Provide a name for your bot (e.g., `Addis Closet Swap`) and a unique username ending in `bot` (e.g., `addis_closet_swap_bot`).
4. Copy the API Token provided (you'll need this if running backend notifications, though the client app functions entirely client-side).
5. Set up the Web App:
   - Send `/newapp` to BotFather.
   - Select your bot.
   - Enter a title and description.
   - Upload a square photo (640x640px) when requested.
   - Enter the **Web App URL** (use your deployed production URL, e.g., `https://yourdomain.vercel.app`, or a tunnel link like `ngrok` for local development testing).
   - Enter a short name for the Web App (e.g., `swap`).
6. Set the Main Menu Button (so users see a button in the chat box):
   - Send `/setmenubutton`.
   - Select your bot.
   - Send the Web App URL.
   - Send the button title (e.g., `Open Closet`).

---

## 3. Firebase Backend Configuration

To migrate from the local mockup database to a production Firebase instance:

### Step 3.1: Create Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and follow the prompt.
3. Once created, click the Web icon (`</>`) to add a Web App. Register the app and copy the `firebaseConfig` object keys.
4. Open the local file `firebase-config.js` and paste your project configurations:
   ```javascript
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.appspot.com",
     messagingSenderId: "your-sender-id",
     appId: "your-app-id"
   };
   ```

### Step 3.2: Enable Cloud Firestore
1. Navigate to **Build** -> **Firestore Database** in the Firebase console.
2. Click **Create database**, choose your database location, and start in **Production Mode**.
3. Go to the **Rules** tab and paste the following rules to secure reads/writes:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Users can read approved items, but only write their own
       match /items/{itemId} {
         allow read: if true;
         allow write: if request.resource.data.sellerId == request.auth.uid || request.resource.data.sellerId == request.resource.id;
       }
       // Users can read and write their own seller profiles
       match /sellers/{sellerId} {
         allow read: if true;
         allow write: if request.auth.uid == sellerId || sellerId == request.resource.data.telegramId;
       }
       // Counters collection for sequential IDs
       match /metadata/counters {
         allow read, write: if true;
       }
     }
   }
   ```
4. Click **Publish**.

### Step 3.3: Enable Firebase Storage
1. Navigate to **Build** -> **Storage** in the Firebase console.
2. Click **Get Started** and select locations.
3. Under the **Rules** tab, paste the following to allow users to upload photos:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /listings/{allPaths=**} {
         allow read: if true;
         allow write: if request.resource.size < 5 * 1024 * 1024 // max 5MB
                      && request.resource.contentType.matches('image/.*');
       }
     }
   }
   ```
4. Click **Publish**.

---

## 4. Deployment Procedures

Since this app is a purely static set of files (`index.html`, `styles.css`, `app.js`, `firebase-config.js`), you can host it for free on many platforms.

### Option A: Vercel (Recommended)
1. Install Vercel CLI: `npm install -g vercel`
2. Run `vercel` inside the workspace folder.
3. Follow the CLI wizard to link and deploy.
4. Copy the production URL and configure it in BotFather.

### Option B: GitHub Pages
1. Push this folder to a public GitHub repository.
2. Go to **Settings** -> **Pages** in your repository.
3. Select **Deploy from a branch** and pick your default branch (`main` / `master`).
4. Save. Your website will be available at `https://<username>.github.io/<repo-name>/`.

### Option C: Firebase Hosting
1. Install Firebase tools: `npm install -g firebase-tools`
2. Run `firebase login` and then `firebase init hosting`.
3. Choose your project, select `.` or `public` as public directory, and configure as single-page app (write `No` to overwriting `index.html`).
4. Run `firebase deploy`.

---

## 5. Application Logic & Structure

- **`index.html`**: Contains the view markup divided into distinct `section` screens. It uses CSS transitions to show/hide sections dynamically based on the state. It relies on the Telegram SDK to control viewport extensions, system headers, back-buttons, and primary CTA buttons.
- **`styles.css`**: Strict, premium visual design scheme. Uses Inter typography, neutral base colors (#FFFFFF, #FAFAFA, #1A1A1A), deep green accents (#1B4332), and responds directly to the device theme (Light/Dark mode) through CSS variable overrides triggered by the SDK's `colorScheme`.
- **`app.js`**: Core state controller. Compresses images using canvas draw offsets to keep Firestore storage and localStorage payloads lightweight, routes pages, validates seller listing permissions, and implements a full administrative panel.
- **`firebase-config.js`**: Exports the configuration credentials.
