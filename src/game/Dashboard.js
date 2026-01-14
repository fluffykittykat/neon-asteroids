import { GeminiAnalyst } from './GeminiAnalyst.js';
import { TelemetryService } from './TelemetryService.js';

const analyst = new GeminiAnalyst();

export class Dashboard {
    constructor(onVisibilityChange) {
        this.onVisibilityChange = onVisibilityChange;
        // Elements are now lazy-loaded in getters or methods to ensure DOM is ready
        this.currentLog = null;

        // Buttons might be outside the overlay, verify they exist
        const closeBtn = document.getElementById('close-dashboard');
        if (closeBtn) closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hide();
        });

        const backBtn = document.getElementById('back-to-list');
        if (backBtn) backBtn.addEventListener('click', () => this.showList());

        // Chat Binds
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-chat-btn');
        if (sendBtn) sendBtn.addEventListener('click', () => this.handleChatSubmit());
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                e.stopPropagation(); // Stop Spacebar from starting game
                if (e.key === 'Enter') this.handleChatSubmit();
            });
            chatInput.addEventListener('keydown', (e) => e.stopPropagation()); // Block all keys (movement)
        }
    }

    get elements() {
        return {
            overlay: document.getElementById('dashboard-overlay'),
            logList: document.getElementById('log-list'),
            logDetails: document.getElementById('log-details'),
            chatHistory: document.getElementById('chat-history'),
            chatInput: document.getElementById('chat-input')
        };
    }

    show(user, lookUpId = null) {
        const ui = this.elements;
        if (!ui.overlay) {
            console.error("Dashboard overlay not found!");
            return;
        }

        this.currentUser = user; // Store full user object
        ui.overlay.classList.remove('hidden');
        if (this.onVisibilityChange) this.onVisibilityChange(true);
        this.loadLogs(user.uid, lookUpId);
        this.showList();
    }

    hide() {
        const ui = this.elements;
        if (ui.overlay) ui.overlay.classList.add('hidden');
        if (this.onVisibilityChange) this.onVisibilityChange(false);
    }

    showList() {
        const ui = this.elements;
        if (ui.logList) ui.logList.classList.remove('hidden');
        if (ui.logDetails) ui.logDetails.classList.add('hidden');
    }

    isVisible() {
        const ui = this.elements;
        return ui.overlay && !ui.overlay.classList.contains('hidden');
    }

    async loadLogs(userId, autoOpenId = null) {
        this.currentLogUserId = userId;
        const ui = this.elements;
        if (!ui.logList) return;

        ui.logList.innerHTML = '<div style="padding:20px; text-align:center;">Loading Records...</div>';

        const logs = await TelemetryService.getHistory(userId);

        ui.logList.innerHTML = '';
        if (logs.length === 0) {
            ui.logList.innerHTML = '<div style="padding:20px; text-align:center;">No flight records found.</div>';
            return;
        }

        logs.forEach(log => {
            const date = new Date(log.timestamp).toLocaleString();
            const div = document.createElement('div');
            div.className = 'log-item';
            div.innerHTML = `<span>${date}</span> <span>Score: ${log.score}</span>`;
            div.onclick = () => this.openDetails(log);
            ui.logList.appendChild(div);

            // AUTO OPEN check
            // We check if this log's ID matches the one we just saved
            // Or if autoOpenId is 'latest' and this is the first one
            if (autoOpenId && log.id === autoOpenId) {
                this.openDetails(log);
            }
        });

        // Fallback: If we just saved but ID matching failed (e.g. slight delay in index), 
        // usually the first one is the latest because of sort order.
        if (autoOpenId && !logs.find(l => l.id === autoOpenId)) {
            // Try opening the first one if it looks "fresh" (within 10 seconds)
            if (logs[0] && Date.now() - logs[0].timestamp < 10000) {
                this.openDetails(logs[0]);
            }
        }
    }

    async openDetails(log) {
        const ui = this.elements;
        this.currentLog = log;

        if (ui.logList) ui.logList.classList.add('hidden');
        if (ui.logDetails) ui.logDetails.classList.remove('hidden');

        const dateEl = document.getElementById('detail-date');
        if (dateEl) dateEl.innerText = new Date(log.timestamp).toLocaleString();

        // Reset Chat
        if (ui.chatHistory) ui.chatHistory.innerHTML = '';

        // Load Persistent Chat History
        if (log.chatTranscript && Array.isArray(log.chatTranscript) && log.chatTranscript.length > 0) {
            log.chatTranscript.forEach(msg => {
                this.addMessage(msg.text, msg.sender);
            });
        }

        // Initial analysis (Local Stats)
        const result = analyst.analyze(log);

        const accEl = document.getElementById('metric-acc');
        if (accEl) accEl.innerText = result.accuracy;
        const killsEl = document.getElementById('metric-kills');
        if (killsEl) killsEl.innerText = result.kills;
        const titleEl = document.getElementById('metric-title');
        if (titleEl) titleEl.innerText = result.title;

        // Skip AI Greeting if we already have chat history
        if (log.chatTranscript && log.chatTranscript.length > 0) {
            return;
        }

        // Initial AI Analysis or Greeting
        if (analyst.getApiKey()) {
            // Capture log reference to prevent race conditions
            const targetLog = log;
            const targetLogId = log.id;

            // Create a unique loading message for this specific analysis
            const loadingMsgId = `loading-${targetLogId}`;
            const loadingDiv = document.createElement('div');
            loadingDiv.id = loadingMsgId;
            loadingDiv.className = 'message ai blink';
            loadingDiv.innerText = 'Analyzing mission telemetry...';
            ui.chatHistory.appendChild(loadingDiv);

            try {
                const displayName = this.currentUser ? this.currentUser.displayName : "Pilot";
                const firstName = displayName.split(' ')[0];
                const summary = await analyst.generateSummary(targetLog, this.currentLogUserId, firstName);

                // STRICT CHECK: Verify we're still on the exact same log
                const currentId = this.currentLog ? this.currentLog.id : null;
                if (currentId !== targetLogId) {
                    console.log(`Log changed: was ${targetLogId}, now ${currentId}. Saving silently.`);
                    // Still save to correct log in DB, but don't update UI
                    if (this.currentLogUserId && targetLogId) {
                        TelemetryService.saveChatMessage(this.currentLogUserId, targetLogId, 'ai', summary);
                    }
                    // Update the target log's local cache
                    if (!targetLog.chatTranscript) targetLog.chatTranscript = [];
                    targetLog.chatTranscript.push({ sender: 'ai', text: summary, timestamp: Date.now() });

                    // Remove our specific loading message if it's still in the DOM
                    const oldLoader = document.getElementById(loadingMsgId);
                    if (oldLoader && oldLoader.parentNode) {
                        oldLoader.parentNode.removeChild(oldLoader);
                    }
                    return;
                }

                // Remove loading message by ID
                const loader = document.getElementById(loadingMsgId);
                if (loader && loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }

                this.addMessage(summary, 'ai');

                // UPDATE LOCAL CACHE so we don't regenerate if user comes back
                if (!targetLog.chatTranscript) targetLog.chatTranscript = [];
                targetLog.chatTranscript.push({ sender: 'ai', text: summary, timestamp: Date.now() });

                // Save this initial summary too!
                if (this.currentLogUserId && targetLogId) {
                    TelemetryService.saveChatMessage(this.currentLogUserId, targetLogId, 'ai', summary);
                }
            } catch (e) {
                // Only show error if still on same log
                const currentId = this.currentLog ? this.currentLog.id : null;
                if (currentId === targetLogId) {
                    // Remove loading message
                    const loader = document.getElementById(loadingMsgId);
                    if (loader && loader.parentNode) {
                        loader.parentNode.removeChild(loader);
                    }
                    this.addMessage("Analysis Failed: " + e.message, 'ai');
                }
            }
        } else {
            this.addMessage("AI Analysis Unavailable: System not configured.", 'ai');
        }
    }

    async handleChatSubmit() {
        const ui = this.elements;
        if (!ui.chatInput) return;

        const text = ui.chatInput.value.trim();
        if (!text) return;

        // Capture references at submit time to prevent race conditions
        const targetLog = this.currentLog;
        const targetLogId = targetLog ? targetLog.id : null;
        const userId = this.currentLogUserId;

        this.addMessage(text, 'user');
        ui.chatInput.value = '';

        // LOCAL CACHE UPDATE (User)
        if (targetLog) {
            if (!targetLog.chatTranscript) targetLog.chatTranscript = [];
            targetLog.chatTranscript.push({ sender: 'user', text: text, timestamp: Date.now() });
        }

        // Save User Message
        if (userId && targetLogId) {
            TelemetryService.saveChatMessage(userId, targetLogId, 'user', text);
        }

        // Command handling removed (API Key is now build-managed)

        // Simulate thinking delay
        const loadingMsg = document.createElement('div');
        loadingMsg.className = 'message ai blink';
        loadingMsg.innerText = 'Analyzing...';
        ui.chatHistory.appendChild(loadingMsg);
        ui.chatHistory.scrollTop = ui.chatHistory.scrollHeight;

        try {
            const displayName = this.currentUser ? this.currentUser.displayName : "Pilot";
            const firstName = displayName.split(' ')[0]; // Use first name only
            const response = await analyst.ask(text, targetLog, userId, firstName);

            // Check if user switched logs during AI response
            if (this.currentLog?.id !== targetLogId) {
                console.log("Log changed during chat, saving to original log only");
                // Save to correct log but don't update UI
                if (userId && targetLogId) {
                    TelemetryService.saveChatMessage(userId, targetLogId, 'ai', response);
                }
                if (targetLog) {
                    targetLog.chatTranscript.push({ sender: 'ai', text: response, timestamp: Date.now() });
                }
                // Remove loading message if it still exists
                if (loadingMsg.parentNode) loadingMsg.parentNode.removeChild(loadingMsg);
                return;
            }

            ui.chatHistory.removeChild(loadingMsg);
            this.addMessage(response, 'ai');

            // LOCAL CACHE UPDATE (AI)
            if (targetLog) {
                targetLog.chatTranscript.push({ sender: 'ai', text: response, timestamp: Date.now() });
            }

            // Save AI Response
            if (userId && targetLogId) {
                TelemetryService.saveChatMessage(userId, targetLogId, 'ai', response);
            }
        } catch (err) {
            if (loadingMsg.parentNode) loadingMsg.parentNode.removeChild(loadingMsg);
            // Only show error if still on same log
            if (this.currentLog?.id === targetLogId) {
                this.addMessage("Error analyzing data.", 'ai');
            }
        }
    }

    addMessage(text, sender) {
        const ui = this.elements;
        if (!ui.chatHistory) return;

        const div = document.createElement('div');
        div.className = `message ${sender}`;
        div.innerText = text;
        ui.chatHistory.appendChild(div);
        ui.chatHistory.scrollTop = ui.chatHistory.scrollHeight;
    }
}
