import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiAnalyst {
    constructor() {
        // Use user-provided key OR runtime env (Docker) OR build-time env (Vite)
        this.apiKey = localStorage.getItem('gemini_api_key') || window.env?.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
        this.genAI = null;
        this.model = null;

        if (this.apiKey) {
            this.initAI();
        }
    }

    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('gemini_api_key', key);
        this.initAI();
    }

    getApiKey() {
        return this.apiKey;
    }

    initAI() {
        try {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.model = null; // Will be set by discovery
            this.currentModelName = null;
        } catch (e) {
            console.error("Failed to init Gemini:", e);
        }
    }

    async ask(question, log, userId, userName) {
        if (!this.apiKey) {
            return "System Error: AI Matrix Disconnected. (API Key Missing in Build Configuration)";
        }

        // Debug Command: List Models
        if (question.trim() === '/models') {
            return await this.debugListModels();
        }

        if (!this.genAI) this.initAI();

        // 1. Kick off History Fetch (Async)
        const historyPromise = (async () => {
            if (userId) {
                try {
                    const { TelemetryService } = await import('./TelemetryService.js');
                    return await TelemetryService.getHistory(userId);
                } catch (e) {
                    console.warn("History fetch failed:", e);
                    return null;
                }
            }
            return null;
        })();

        // 2. Kick off Model Discovery (Async)
        const modelPromise = (async () => {
            if (!this.currentModelName || !this.model) {
                try {
                    const bestModel = await this.discoverBestModel();
                    console.log(`Auto-Discovered Model: ${bestModel}`);
                    this.currentModelName = bestModel;
                    this.model = this.genAI.getGenerativeModel({ model: bestModel });
                } catch (e) {
                    console.error("Model discovery failed, using fallback.", e);
                    this.currentModelName = "gemini-flash-latest";
                    if (this.genAI) {
                        this.model = this.genAI.getGenerativeModel({ model: "gemini-flash-latest" });
                    }
                }
            }
        })();

        // 2b. Kick off Global Stats Fetch (Async)
        const globalPromise = (async () => {
            try {
                const { TelemetryService } = await import('./TelemetryService.js');
                return await TelemetryService.getGlobalStats();
            } catch (e) {
                console.warn("Global stats fetch failed:", e);
                return null;
            }
        })();

        // 3. Await History and Build Context
        let historyContext = "No prior records found.";
        try {
            const history = await historyPromise;
            if (history && history.length > 1) {
                const pastGames = history.filter(h => h.timestamp !== log.timestamp).slice(0, 5);

                const historyList = pastGames.map(g => {
                    const d = new Date(g.timestamp);
                    return `- ${d.toLocaleDateString()} at ${d.toLocaleTimeString()}: ${g.score} pts`;
                }).join('\n                  ');

                const avgScore = Math.round(pastGames.reduce((a, b) => a + b.score, 0) / (pastGames.length || 1));
                historyContext = `
                  Player History Summary (Last 5 Games):
                  - Average Score: ${avgScore}
                  - Current Score: ${log.score}
                  
                  Previous Missions for Comparison:
                  ${historyList}
                  `;
            }
        } catch (e) {
            console.warn("History context build failed:", e);
        }

        // 4. Construct Prompt inputs
        const telemetrySummary = JSON.stringify(log.events.slice(-75)); // Increased context
        const stats = log.stats || {};
        const missionDate = new Date(log.timestamp);

        // 4b. Build Global Ranking Context
        let globalContext = "Global data unavailable.";
        try {
            const globalStats = await globalPromise;
            if (globalStats) {
                // Calculate percentile
                const rank = globalStats.scores.filter(s => s > log.score).length + 1;
                const percentile = Math.round((1 - rank / globalStats.totalGames) * 100);

                // Build per-player roster (exclude current user for comparison)
                const otherPilots = globalStats.playerProfiles || [];
                const pilotRoster = otherPilots.slice(0, 10).map((p, i) =>
                    `  ${i + 1}. "${p.name}" — Best: ${p.bestScore}, Avg: ${p.avgScore}, Accuracy: ${p.avgAccuracy}%, Games: ${p.gamesPlayed}, Best Level: ${p.bestLevel}`
                ).join('\n');

                // Find current player's profile in the roster
                const currentProfile = otherPilots.find(p => p.uid === userId);
                const currentProfileStr = currentProfile
                    ? `Current Pilot's Profile: Best: ${currentProfile.bestScore}, Avg: ${currentProfile.avgScore}, Accuracy: ${currentProfile.avgAccuracy}%, Games: ${currentProfile.gamesPlayed}`
                    : 'Current Pilot: New player (no historical profile)';

                globalContext = `
              GLOBAL RANKINGS (across all pilots):
              - This mission's score: ${log.score} (Rank #${rank} of ${globalStats.totalGames} total games)
              - Top ${percentile}% of all pilots
              - Global Top Score: ${globalStats.topScore} by "${globalStats.topPlayerName}"
              - Global Average Score: ${globalStats.avgScore}
              - Global Median Score: ${globalStats.medianScore}
              - Global Average Accuracy: ${globalStats.avgAccuracy}%
              - Total Unique Pilots: ${globalStats.uniquePlayers}

              ${currentProfileStr}

              PILOT ROSTER (all known pilots, ranked by best score):
${pilotRoster}
              `;
            }
        } catch (e) {
            console.warn("Global context build failed:", e);
        }

        const prompt = `
        You are the ship's AI computer for "Prograde Sun".
        
        CURRENT MISSION DATA:
        - Pilot: ${userName || "Anonymous Pilot"}
        - Date: ${missionDate.toLocaleDateString()}
        - Time: ${missionDate.toLocaleTimeString()}
        - Score: ${log.score}
        - Level: ${log.level}
        - Duration: ${Math.round((log.duration || 0) / 1000)}s
        
        PILOT BEHAVIOR METRICS:
        - Accuracy: ${this.analyze(log).accuracy}
        - Panic Spins (360 spins w/o firing): ${stats.panicSpins || 0}
        - Close Calls (Near miss): ${stats.closeCalls || 0}
        - Time Camping (Standing still): ${Math.round(stats.timeCamping || 0)}s
        - Aliens Destroyed: ${stats.aliensKilled || 0}
        - Alien Shots Survived: ${stats.alienShotsDodged || 0} (Hits: ${stats.alienHitsTaken || 0})
        - Asteroid Colors Hit: ${JSON.stringify(stats.asteroidColorMap || {})}
        
        HISTORICAL CONTEXT (this pilot's own past games):
        ${historyContext}

        ${globalContext}
        
        RECENT EVENTS (JSON):
        ${telemetrySummary}

        USER QUESTION: "${question}"

        SYSTEM INSTRUCTIONS (PERSONALITY MODE: SASSY & CONCISE):
        1. **Tone**: You are sassy, sharp, and brutally concise. Think of a witty, unimpressed AI that doesn't waste time on pleasantries.
        2. **Content Restrictions**: You ONLY discuss game stats, performance, and piloting ability. 
           - If the user asks about ANYTHING unrelated to the game (weather, personal questions, other topics, jokes, etc.), give a brief sassy dismissal like "I'm a flight computer, not your therapist. Ask me about your terrible accuracy instead." or "That's outside my operational parameters. Let's talk about those ${stats.panicSpins || 0} panic spins instead."
        3. **Personalize**: Use the pilot's name ("${userName || "Pilot"}") if it makes the roast sting more.
        4. **Player Comparisons**: You have the PILOT ROSTER with stats for every known pilot. ALWAYS compare the current pilot against specific other players BY NAME. Examples: "While you scored ${log.score}, [OtherPilot] averages [X] — that's [better/worse] than your lifetime average." or "[OtherPilot] has ${stats.panicSpins || 0 > 3 ? 'fewer' : 'more'} panic spins than you." Make it personal, competitive, and specific. Reference both the pilot's own history AND other players.
        5. **Formatting**:
           - **Length**: 5 to 8 sentences for game-related questions. 1-2 sentences for off-topic dismissals.
           - **Style**: Short, punchy sentences. No fluff or rambling.
           - **Requirement**: You MUST mention at least one specific stat AND at least one other pilot by name to prove you know the competition.
           - No bullet points in follow-up responses. Just one sharp paragraph.
        `;

        // 5. Ensure Model is Ready
        await modelPromise;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error(`Gemini Error (${this.currentModelName}):`, error);

            // Check for actual API key issues first
            if (error.message.includes("API_KEY_INVALID") || error.message.includes("API key not valid")) {
                return "Error: Invalid API Key. Please update it.";
            }

            // Fallback Logic for model errors (404, deprecated, unavailable)
            if (error.message.includes('404') || error.message.includes('not found') || error.message.includes('no longer available') || error.message.includes('deprecated')) {
                console.warn(`Model ${this.currentModelName} failed. Attempting re-discovery.`);
                try {
                    // Reset cached model so discovery runs fresh
                    this.currentModelName = null;
                    this.model = null;
                    const bestModel = await this.discoverBestModel();
                    console.log(`Re-Discovered Model: ${bestModel}`);
                    this.currentModelName = bestModel;
                    this.model = this.genAI.getGenerativeModel({ model: bestModel });

                    const result = await this.model.generateContent(prompt);
                    const response = await result.response;
                    return response.text();
                } catch (fallbackError) {
                    console.error("Model re-discovery and fallback failed:", fallbackError);
                    return `Error: AI model unavailable. (${fallbackError.message})`;
                }
            }

            return `Communication Error with ${this.currentModelName}. Try /models to debug or check console.`;
        }
    }

    async discoverBestModel() {
        if (!this.apiKey) return "gemini-flash-latest"; // Fallback default

        try {
            // Fetch available models dynamically
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
            const data = await response.json();

            if (!data.models) {
                console.warn("No models returned by API, using default.");
                return "gemini-flash-latest";
            }

            const modelNames = data.models.map(m => m.name);
            console.log("Available Models:", modelNames);

            // Priority List (cheapest first — confirmed from ai.google.dev/gemini-api/docs/models)
            const candidates = [
                'models/gemini-2.5-flash-lite',
                'models/gemini-2.5-flash',
                'models/gemini-flash-latest'
            ];

            // return the first match found in available models
            for (const c of candidates) {
                if (modelNames.includes(c)) {
                    // Remove 'models/' prefix if the library expects just the name
                    // The Google library usually accepts both, but let's be safe and strip 'models/' 
                    // IF the user input usually usually doesn't have it. 
                    // Actually, the library handles "gemini-pro" -> "models/gemini-pro" internally.
                    // So we should return just the name part.
                    return c.replace('models/', '');
                }
            }

            // If no specific candidate found, pick the first non-deprecated gemini model
            const deprecated = ['1.0', '1.5', '2.0-flash'];
            const fallback = modelNames.find(m =>
                m.includes('gemini') &&
                !m.includes('vision') &&
                !deprecated.some(d => m.includes(d))
            );
            return fallback ? fallback.replace('models/', '') : "gemini-flash-latest";

        } catch (e) {
            console.error("Failed to list models:", e);
            return "gemini-flash-latest";
        }
    }

    async generateSummary(log, userId, userName) {
        const stats = log.stats || {};
        const accuracy = this.analyze(log).accuracy;
        const duration = Math.round((log.duration || 0) / 1000);

        // Format asteroid size breakdown
        const sizeMap = stats.asteroidSizeMap || { Small: 0, Medium: 0, Large: 0 };
        const sizeBreakdown = `Small: ${sizeMap.Small || 0}, Medium: ${sizeMap.Medium || 0}, Large: ${sizeMap.Large || 0}`;

        // Helper: Convert hex color to human-readable name
        const hexToColorName = (hex) => {
            const colorLower = (hex || '').toLowerCase();
            if (colorLower.includes('ff00ff') || colorLower.includes('f0f')) return 'Magenta';
            if (colorLower.includes('00ffff') || colorLower.includes('0ff')) return 'Cyan';
            if (colorLower.includes('ffff00') || colorLower.includes('ff0')) return 'Yellow';
            if (colorLower.includes('00ff00') || colorLower.includes('0f0')) return 'Green';
            if (colorLower.includes('ff0000') || colorLower.includes('f00')) return 'Red';
            if (colorLower.includes('ff6600') || colorLower.includes('f60')) return 'Orange';
            if (colorLower.includes('0000ff') || colorLower.includes('00f')) return 'Blue';
            if (colorLower.includes('ffffff') || colorLower.includes('fff')) return 'White';
            if (colorLower.includes('ff66ff') || colorLower.includes('f6f')) return 'Pink';
            if (colorLower.includes('66ff66')) return 'Light Green';
            if (colorLower.includes('6666ff')) return 'Light Blue';
            if (colorLower.includes('ffff66')) return 'Light Yellow';
            // Default: return a cleaned version
            return hex.replace('#', '').toUpperCase();
        };

        // Format asteroid color breakdown with human-readable names
        const colorMap = stats.asteroidColorMap || {};
        const colorBreakdown = Object.keys(colorMap).length > 0
            ? Object.entries(colorMap).map(([color, count]) => `${hexToColorName(color)}: ${count}`).join(', ')
            : 'None';

        // Build the stats bullet list
        const statsList = `
**MISSION STATS:**
• Score: ${log.score}
• Level Reached: ${log.level}
• Duration: ${duration}s
• Accuracy: ${accuracy}
• Shots Fired: ${stats.shotsFired || 0}
• Asteroids Destroyed: ${stats.hits || 0}
• Aliens Destroyed: ${stats.aliensKilled || 0}
• Aliens Spawned: ${stats.aliensSpawned || 0}
• Alien Hits Taken: ${stats.alienHitsTaken || 0}
• Panic Spins: ${stats.panicSpins || 0}
• Close Calls: ${stats.closeCalls || 0}
• Time Camping: ${Math.round(stats.timeCamping || 0)}s

**ASTEROID BREAKDOWN:**
• By Size: ${sizeBreakdown}
• By Color: ${colorBreakdown}
`;

        // Get the sassy summary from AI (now includes global comparison via ask())
        const sassyResponse = await this.ask("Give me a harsh, sarcastic summary of this mission performance. Compare me against other pilots globally. Mention my rank and the most embarrassing stat.", log, userId, userName);

        // Combine stats + sassy response
        return statsList + "\n" + sassyResponse;
    }

    // Legacy method for quick summary if needed, or we can use AI for this too
    analyze(log) {
        let shots = log.events.filter(e => e.type === 'fire').length;
        let hits = log.events.filter(e => e.targetType === 'asteroid').length;

        // Prefer explicit stats if available (Post-Update V2)
        if (log.stats && log.stats.shotsFired !== undefined) {
            shots = log.stats.shotsFired;
            hits = log.stats.hits || 0;
        }

        const accuracy = shots > 0 ? Math.round((hits / shots) * 100) : 0;

        return {
            title: `Mission Report: Level ${log.level}`,
            accuracy: accuracy + "%",
            kills: hits
        };
    }

    async debugListModels() {
        if (!this.apiKey) return "No API Key set.";
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
            const data = await response.json();
            if (data.error) {
                return `API Error: ${data.error.message}\nMake sure your Project has 'Generative Language API' enabled.`;
            }
            if (!data.models) {
                return "No models found (Empty Response).";
            }
            return "Available Models:\n" + data.models.map(m => m.name.replace('models/', '')).join('\n');
        } catch (e) {
            return `Fetch Error: ${e.message}`;
        }
    }
}
