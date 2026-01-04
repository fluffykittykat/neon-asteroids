import { getFirestore, collection, addDoc, doc, setDoc, query, orderBy, limit, getDocs } from "firebase/firestore";
import { app } from "./AuthService.js";

let db;
try {
    if (app) {
        db = getFirestore(app);
    }
} catch (e) {
    console.warn("Firestore Setup Failed:", e);
}

export const TelemetryService = {
    logs: [],
    startTime: 0,
    sessionId: null,

    startSession: () => {
        TelemetryService.logs = [];
        TelemetryService.startTime = Date.now();
        TelemetryService.sessionId = crypto.randomUUID();
        console.log("Telemetry Session Started:", TelemetryService.sessionId);
    },

    logEvent: (type, data = {}) => {
        if (!TelemetryService.sessionId) return; // Not recording

        const entry = {
            t: Date.now() - TelemetryService.startTime,
            type: type,
            ...data
        };
        TelemetryService.logs.push(entry);
    },

    saveSession: async (userId, score, level, stats) => {
        if (!db || !userId) {
            console.warn("Cannot save telemetry: No DB or User");
            return;
        }

        const gameData = {
            timestamp: Date.now(),
            duration: Date.now() - TelemetryService.startTime,
            score: score,
            level: level,
            events: TelemetryService.logs, // Save the raw flight log
            stats: stats || {}, // Save the extended stats
            processed: false // Trigger for AI Analysis
        };

        try {
            // Path: users/{userId}/games/{gameId}
            const userRef = doc(db, "users", userId);
            const gamesRef = collection(userRef, "games");
            await addDoc(gamesRef, gameData);
            console.log("Telemetry Saved to Firestore!");
            alert("Flight Log Saved to Database!"); // VISIBLE FEEDBACK
            return true;
        } catch (e) {
            console.error("Failed to save telemetry:", e);
            alert("Telemetry Error: " + e.message + "\n(Did you enable Firestore in the Console?)");
            return false;
        }
    },

    testConnection: async (userId) => {
        if (!db) { alert("Firestore not initialized!"); return; }
        try {
            const userRef = doc(db, "users", userId);
            const gamesRef = collection(userRef, "games");
            await addDoc(gamesRef, { test: true, timestamp: Date.now() });
            alert("SUCCESS! Database is connected and writable.");
        } catch (e) {
            alert("DATABASE ERROR: " + e.message + "\n\nCheck your Rules in Firebase Console.");
        }
    },

    getHistory: async (userId) => {
        if (!db) return [];
        try {
            const userRef = doc(db, "users", userId);
            const gamesRef = collection(userRef, "games");
            const q = query(gamesRef, orderBy("timestamp", "desc"), limit(500));
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => doc.data());
        } catch (e) {
            console.error("Error fetching history:", e);
            if (e.message.includes("requires an index")) {
                alert("Firestore Error: Missing Index. Check Console for link to create it.");
            } else {
                alert("Failed to load flight logs: " + e.message);
            }
            return [];
        }
    }
};
