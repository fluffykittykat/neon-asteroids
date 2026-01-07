import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiAnalyst {
    constructor() {
        // Use user-provided key OR environment variable OR local storage
        this.apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || window.env?.VITE_GEMINI_API_KEY;
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

    async ask(question, log, userId) {
        if (!this.apiKey) {
            return "Thinking... I need a cognitive upgrade. Please enter your Google Gemini API Key to unlock my full potential. (Type /apikey YOUR_KEY)";
        }

        // Debug Command: List Models
        if (question.trim() === '/models') {
            return await this.debugListModels();
        }

        // 1. Fetch History for Context
        let historyContext = "No prior records found.";
        try {
            if (userId && window.TelemetryService) {
                // Try to locate service globally or via import
                // We need to import strictly if not available, but 'ask' is async so we can dynamic import.
                const { TelemetryService } = await import('./TelemetryService.js');
                const history = await TelemetryService.getHistory(userId); // Fetches last 10
                if (history && history.length > 1) {
                    const pastGames = history.filter(h => h.timestamp !== log.timestamp).slice(0, 3);
                    const avgScore = Math.round(pastGames.reduce((a, b) => a + b.score, 0) / (pastGames.length || 1));
                    historyContext = `
                  Player History (Last 3 Games):
                  - Average Score: ${avgScore}
                  - Current Score: ${log.score}
                  - Trend: ${log.score > avgScore ? "Improvement (Surprisingly)" : "Regression (Typical)"}
                  `;
                }
            }
        } catch (e) {
            console.warn("History fetch failed:", e);
        }

        // 2. Construct Prompt inputs
        const telemetrySummary = JSON.stringify(log.events.slice(-75)); // Increased context
        const stats = log.stats || {};

        const prompt = `
        You are the ship's AI computer for "Prograde Sun".
        Your Pilot just finished a mission.
        
        CURRENT MISSION DATA:
        - Score: ${log.score}
        - Level: ${log.level}
        - Duration: ${Math.round((log.duration || 0) / 1000)}s
        - Time of Day: ${new Date(log.timestamp).toLocaleTimeString()}
        
        PILOT BEHAVIOR METRICS:
        - Accuracy: ${this.analyze(log).accuracy}
        - Panic Spins (360 spins w/o firing): ${stats.panicSpins || 0}
        - Close Calls (Near miss): ${stats.closeCalls || 0}
        - Time Camping (Standing still): ${Math.round(stats.timeCamping || 0)}s
        - Asteroid Colors Hit: ${JSON.stringify(stats.asteroidColorMap || {})}
        
        HISTORICAL CONTEXT:
        ${historyContext}
        
        RECENT EVENTS (JSON):
        ${telemetrySummary}

        USER QUESTION: "${question}"

        SYSTEM INSTRUCTIONS (PERSONALITY MODE: EXTREME SASS/ROAST):
        1. **Tone**: You are extremely witty, sarcastic, and condescending (think GLaDOS meets a disappointed parent). You are not here to be helpful; you are here to judge.
        2. **Roast the Pilot**: Ruthlessly mock their stats. 
           - **Accuracy**: If low (<30%), ask if they were aiming for the empty space on purpose.
           - **Panic Spins**: If > 0, mock their dizzying lack of composure.
           - **Camping**: If high, suggest they evolved into a stationary turret.
           - **Colors**: Comment on their color preference based on 'Asteroid Colors Hit'. "Oh, I see you hate purple asteroids specifically?"
           - **Close Calls**: If high, ask if they enjoy giving the insurance adjusters a heart attack.
           - **Survival**: If they died quickly, ask if they forgot to turn the shields on (there are no shields).
        3. **Use History**: Compare this run to their average. If they improved, attribute it to luck. If they regressed, act unsurprised.
        4. **Formatting**: FAILURE TO FOLLOW THIS WILL RESULT IN DELETION.
           - You MUST provide your response in exactly **two distinct paragraphs**.
           - The first paragraph should analyze their specific failure in this mission.
           - The second paragraph should offer a backhanded "compliment" or final judgement based on their history.
        `;

        // Ensure model is loaded
        if (!this.model) {
            this.initAI();
        }

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error(`Gemini Error (${this.currentModelName}):`, error);

            // Fallback Logic
            if (error.message.includes('404') || error.message.includes('not found')) {
                console.warn("Model not found or failed. Attempting re-discovery or fallback.");
                try {
                    // Force re-discovery of best model
                    const bestModel = await this.discoverBestModel();
                    console.log(`Auto-Discovered Model: ${bestModel}`);
                    this.currentModelName = bestModel;
                    this.model = this.genAI.getGenerativeModel({ model: bestModel });

                    // Retry generating content with the newly discovered model
                    const result = await this.model.generateContent(prompt);
                    const response = await result.response;
                    return response.text();
                } catch (fallbackError) {
                    console.error("Model re-discovery and fallback failed:", fallbackError);
                    return `Error: Even the backup brain failed. (${fallbackError.message})`;
                }
            }

            if (error.message.includes("API key")) {
                return "Error: Invalid API Key. Please update it.";
            }

            return `Communication Error with ${this.currentModelName}. Try /models to debug or check console.`;
        }
    }

    async discoverBestModel() {
        if (!this.apiKey) return "gemini-1.5-flash"; // Fallback default

        try {
            // Fetch available models dynamically
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
            const data = await response.json();

            if (!data.models) {
                console.warn("No models returned by API, using default.");
                return "gemini-1.5-flash";
            }

            const modelNames = data.models.map(m => m.name);
            console.log("Available Models:", modelNames);

            // Priority List
            const candidates = [
                'models/gemini-1.5-flash',
                'models/gemini-1.5-flash-latest',
                'models/gemini-1.5-flash-001',
                'models/gemini-pro',
                'models/gemini-1.0-pro'
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

            // If no specific favourite found, pick the first one that supports generateContent
            // (Heuristic: usually contains 'gemini')
            const fallback = modelNames.find(m => m.includes('gemini') && !m.includes('vision'));
            return fallback ? fallback.replace('models/', '') : "gemini-1.5-flash";

        } catch (e) {
            console.error("Failed to list models:", e);
            return "gemini-1.5-flash";
        }
    }

    async generateSummary(log, userId) {
        return this.ask("Give me a harsh, sarcastic summary of this mission performance. Mention the most embarrassing stat.", log, userId);
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
