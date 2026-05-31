// Firebase Configuration for Addis Closet Swap
// Fill in your Firebase Project details below.
// If left empty or with defaults, the application will automatically fall back to LocalStorage.

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_AUTH_DOMAIN_HERE",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"
};

// Export config to be used globally
window.firebaseConfig = firebaseConfig;
