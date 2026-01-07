import { GeminiAnalyst } from './GeminiAnalyst.js';
import { TelemetryService } from './TelemetryService.js';

const analyst = new GeminiAnalyst();

export class Dashboard {
    constructor() {
        // Elements are now lazy-loaded in getters or methods to ensure DOM is ready
        this.currentLog = null;

        // Buttons might be outside the overlay, verify they exist
        const closeBtn = document.getElementById('close-dashboard');
        if (closeBtn) closeBtn.addEventListener('click', () => this.hide());

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

    show(userId) {
        const ui = this.elements;
        if (!ui.overlay) {
            console.error("Dashboard overlay not found!");
            return;
        }

        ui.overlay.classList.remove('hidden');
        this.loadLogs(userId);
        this.showList();
    }

    hide() {
        const ui = this.elements;
        if (ui.overlay) ui.overlay.classList.add('hidden');
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

    async loadLogs(userId) {
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
        });
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

        // Initial analysis (Local Stats)
        const result = analyst.analyze(log);

        const accEl = document.getElementById('metric-acc');
        if (accEl) accEl.innerText = result.accuracy;
        const killsEl = document.getElementById('metric-kills');
        if (killsEl) killsEl.innerText = result.kills;
        const titleEl = document.getElementById('metric-title');
        if (titleEl) titleEl.innerText = result.title;

        // Initial AI Analysis or Greeting
        if (analyst.getApiKey()) {
            this.addMessage("Analyzing mission telemetry...", 'ai blink');
            try {
                const summary = await analyst.generateSummary(log, this.currentLogUserId);
                // Remove loading message (simple way: clear last child or just append, but let's clear to be clean)
                if (ui.chatHistory.lastChild && ui.chatHistory.lastChild.innerText === "Analyzing mission telemetry...") {
                    ui.chatHistory.removeChild(ui.chatHistory.lastChild);
                }
                this.addMessage(summary, 'ai');
            } catch (e) {
                this.addMessage("Analysis Failed: " + e.message, 'ai');
            }
        } else {
            this.addMessage("Flight Data Loaded. To enable AI analysis, please provide a Gemini API Key.", 'ai');
            setTimeout(() => {
                this.addMessage("WARNING: Cognitive Processors Offline. Please enter your Google Gemini API Key to enable advanced analysis. (Type /apikey YOUR_KEY)", 'ai');
            }, 500);
        }
    }

    async handleChatSubmit() {
        const ui = this.elements;
        if (!ui.chatInput) return;

        const text = ui.chatInput.value.trim();
        if (!text) return;

        this.addMessage(text, 'user');
        ui.chatInput.value = '';

        // Check for commands
        if (text.startsWith('/apikey ')) {
            const key = text.split(' ')[1];
            if (key) {
                analyst.setApiKey(key);
                this.addMessage("API Key saved. Cognitive systems online.", 'ai');
            } else {
                this.addMessage("Invalid Syntax. Usage: /apikey YOUR_KEY", 'ai');
            }
            return;
        }

        // Simulate thinking delay
        const loadingMsg = document.createElement('div');
        loadingMsg.className = 'message ai blink';
        loadingMsg.innerText = 'Analyzing...';
        ui.chatHistory.appendChild(loadingMsg);
        ui.chatHistory.scrollTop = ui.chatHistory.scrollHeight;

        try {
            // Get current user ID from the log itself or auth service?
            // Since we are viewing a log, the log owner IS the user we want history for.
            // But we can also look up the "currentUser" if needed. 
            // The dashboard's loadLogs was called with userId. We should cache it.
            const userId = this.currentLogUserId;

            const response = await analyst.ask(text, this.currentLog, userId);
            ui.chatHistory.removeChild(loadingMsg);
            this.addMessage(response, 'ai');
        } catch (err) {
            ui.chatHistory.removeChild(loadingMsg);
            this.addMessage("Error analyzing data.", 'ai');
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
