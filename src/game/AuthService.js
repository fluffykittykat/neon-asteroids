// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence } from "firebase/auth";

// TODO: REPLACE THIS WITH YOUR FIREBASE CONFIG
// Go to Firebase Console -> Project Settings -> General -> Your Apps -> SDK Setup
// Config from User Screenshot
const firebaseConfig = {
    apiKey: "AIzaSyAZVuE5rZRXSXJ7G_wISrfooTGgbp15-dg",
    authDomain: "astroids-3a3fb.firebaseapp.com",
    projectId: "astroids-3a3fb",
    storageBucket: "astroids-3a3fb.firebasestorage.app",
    messagingSenderId: "210721664554",
    appId: "1:210721664554:web:270e0fd47dec19a6d35d53",
    measurementId: "G-4T2YZMX762"
};

// Initialize Firebase
export let app;
let auth;
let provider;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();

    // Force Google to always show account picker (no auto-select)
    provider.setCustomParameters({
        prompt: 'select_account'
    });

    // Set session persistence - user must log in each browser session
    // This prevents auto-login after logout or page refresh
    setPersistence(auth, browserSessionPersistence).catch((e) => {
        console.warn("Failed to set session persistence:", e);
    });
} catch (e) {
    console.error("Firebase Initialization Failed (Did you add your config?):", e);
}

export const AuthService = {
    login: async () => {
        if (!auth) {
            alert("Configuration Missing!\n\nI need you to paste your Firebase Keys into 'src/game/AuthService.js'.\n\nI cannot generate these for you because they require access to your personal Google Cloud account.");
            return;
        }
        try {
            const result = await signInWithPopup(auth, provider);
            return result.user;
        } catch (error) {
            console.error("Login Failed:", error);
            alert("Login Failed:\n" + error.message);
            throw error;
        }
    },

    logout: async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            console.log("User signed out successfully");

            // Force page reload to clear any cached state
            // This ensures a clean slate for the next login
            window.location.reload();
        } catch (error) {
            console.error("Logout Failed:", error);
        }
    },

    onUserChange: (callback) => {
        if (!auth) return;
        onAuthStateChanged(auth, callback);
    }
};
