import { getFirestore, collection, addDoc, doc, setDoc, getDoc, query, orderBy, limit, getDocs, updateDoc, arrayUnion, where } from "firebase/firestore";
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

        let duration = Date.now() - TelemetryService.startTime;

        // Sanity Check: If duration is huge (e.g. > 1 year), it means startTime was 0.
        // Try to recover using game stats or just fail gracefully.
        if (duration > 31536000000) { // 1 year in ms
            console.warn("Invalid Telemetry Duration detected (startTime was 0). Attempting recovery...");
            if (stats && stats.startTime) {
                duration = Date.now() - stats.startTime;
            } else {
                duration = 0; // Fallback
            }
        }

        const gameData = {
            timestamp: Date.now(),
            duration: duration,
            score: score,
            level: level,
            events: TelemetryService.logs, // Save the raw flight log
            stats: stats || {}, // Save the extended stats
            processed: false, // Trigger for AI Analysis
            chatTranscript: [] // Initialize empty chat
        };

        try {
            // Path: users/{userId}/games/{gameId}
            const userRef = doc(db, "users", userId);
            const gamesRef = collection(userRef, "games");
            await addDoc(gamesRef, gameData);
            console.log("Telemetry Saved to Firestore!", userRef.id);

            // Also save to global leaderboard
            TelemetryService.saveToLeaderboard(userId, score, level, stats);

            return userRef.id; // Return ID for auto-open
        } catch (e) {
            console.error("Failed to save telemetry:", e);
            alert("Telemetry Error: " + e.message + "\n(Did you enable Firestore in the Console?)");
            return null;
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

            // Include Document ID for updates
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error("Error fetching history:", e);
            if (e.message.includes("requires an index")) {
                alert("Firestore Error: Missing Index. Check Console for link to create it.");
            } else {
                alert("Failed to load flight logs: " + e.message);
            }
            return [];
        }
    },

    saveChatMessage: async (userId, gameId, sender, text) => {
        if (!db) return;
        try {
            const gameRef = doc(db, "users", userId, "games", gameId);
            await updateDoc(gameRef, {
                chatTranscript: arrayUnion({
                    sender: sender,
                    text: text,
                    timestamp: Date.now()
                })
            });
        } catch (e) {
            console.error("Failed to save chat message:", e);
        }
    },

    updateUserProfile: async (user) => {
        if (!db || !user) return;
        try {
            const userRef = doc(db, "users", user.uid);

            // Collect all available user data from Firebase Auth
            const profileData = {
                // Core Identity
                uid: user.uid,
                displayName: user.displayName || null,
                email: user.email || null,
                photoURL: user.photoURL || null,
                phoneNumber: user.phoneNumber || null,

                // Verification Status
                emailVerified: user.emailVerified || false,
                isAnonymous: user.isAnonymous || false,

                // Timestamps
                lastLogin: Date.now(),
                createdAt: user.metadata?.creationTime || null,
                lastSignIn: user.metadata?.lastSignInTime || null,

                // Provider Information
                providerId: user.providerData?.[0]?.providerId || 'unknown',
                providerUid: user.providerData?.[0]?.uid || null,
            };

            await setDoc(userRef, profileData, { merge: true });
            console.log("User Profile Updated in Firestore:", profileData.displayName);

            // Trigger one-time leaderboard backfill for this user
            TelemetryService.backfillLeaderboard(user.uid, profileData.displayName, profileData.photoURL);
        } catch (e) {
            console.error("Failed to update user profile:", e);
        }
    },

    backfillLeaderboard: async (userId, displayName, photoURL) => {
        if (!db || !userId) return;

        // Only backfill once per user
        const key = `lb_backfilled_v2_${userId}`;
        if (localStorage.getItem(key)) return;

        try {
            console.log("Backfilling leaderboard for user:", userId);
            const userRef = doc(db, "users", userId);
            const gamesRef = collection(userRef, "games");
            const q = query(gamesRef, orderBy("timestamp", "desc"), limit(50));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                localStorage.setItem(key, '1');
                return;
            }

            let count = 0;
            for (const gameDoc of snapshot.docs) {
                const g = gameDoc.data();
                if (g.test || !g.score) continue; // Skip test entries

                const stats = g.stats || {};
                const accuracy = stats.shotsFired > 0 ? Math.round((stats.hits / stats.shotsFired) * 100) : 0;

                await addDoc(collection(db, "leaderboard"), {
                    uid: userId,
                    displayName: displayName || 'Anonymous Pilot',
                    photoURL: photoURL || null,
                    score: g.score,
                    level: g.level || 1,
                    accuracy: accuracy,
                    timestamp: g.timestamp || Date.now()
                });
                count++;
            }

            localStorage.setItem(key, '1');
            console.log(`Backfilled ${count} leaderboard entries for ${displayName}`);
        } catch (e) {
            console.warn("Leaderboard backfill failed:", e);
        }
    },

    saveToLeaderboard: async (userId, score, level, stats) => {
        if (!db || !userId) return;
        try {
            // Get user profile for display name and photo
            const userRef = doc(db, "users", userId);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.exists() ? userSnap.data() : {};

            await addDoc(collection(db, "leaderboard"), {
                uid: userId,
                displayName: userData.displayName || 'Anonymous Pilot',
                photoURL: userData.photoURL || null,
                score: score,
                level: level,
                accuracy: stats.shotsFired > 0 ? Math.round((stats.hits / stats.shotsFired) * 100) : 0,
                timestamp: Date.now()
            });
            console.log("Leaderboard entry saved!");
        } catch (e) {
            console.warn("Failed to save leaderboard entry:", e);
        }
    },

    getLeaderboard: async () => {
        if (!db) return [];
        try {
            const q = query(
                collection(db, "leaderboard"),
                orderBy("score", "desc"),
                limit(10)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => d.data());
        } catch (e) {
            console.warn("Failed to fetch leaderboard:", e);
            return [];
        }
    },

    getGlobalStats: async () => {
        if (!db) return null;
        try {
            // Fetch top 100 recent scores for aggregate stats
            const q = query(
                collection(db, "leaderboard"),
                orderBy("score", "desc"),
                limit(100)
            );
            const snapshot = await getDocs(q);
            const entries = snapshot.docs.map(d => d.data());

            if (entries.length === 0) return null;

            const scores = entries.map(e => e.score);
            const accuracies = entries.map(e => e.accuracy || 0);
            const uniquePlayers = new Set(entries.map(e => e.uid)).size;

            return {
                totalGames: entries.length,
                uniquePlayers: uniquePlayers,
                topScore: scores[0],
                topPlayerName: entries[0].displayName,
                avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
                medianScore: scores[Math.floor(scores.length / 2)],
                avgAccuracy: Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length),
                scores: scores // For percentile calculation
            };
        } catch (e) {
            console.warn("Failed to fetch global stats:", e);
            return null;
        }
    }
};
