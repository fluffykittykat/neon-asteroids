import { AuthService } from "./AuthService.js";
import { TelemetryService } from "./TelemetryService.js";

export class UIManager {
    constructor() {
        // Score / HUD elements
        this.uiScore = document.getElementById('score');
        this.uiHighScore = document.getElementById('high-score');
        this.uiLives = document.getElementById('lives');
        this.uiFinalScore = document.getElementById('final-score');

        // Screen overlays
        this.uiStartScreen = document.getElementById('start-screen');
        this.uiGameOverScreen = document.getElementById('game-over-screen');

        // Auth UI
        this.btnLogin = document.getElementById('login-btn');
        this.userProfile = document.getElementById('user-profile');
        this.userAvatar = document.getElementById('user-avatar');
        this.userName = document.getElementById('user-name');
        this.btnLogs = document.getElementById('view-logs-btn');
        this.btnLogout = document.getElementById('logout-btn');
        this.startPrompt = document.getElementById('start-prompt');
    }

    // ── Auth wiring ─────────────────────────────────────────────────────
    /**
     * @param {Object} callbacks
     * @param {Function} callbacks.onLogsClick  - called with (user) when logs button clicked
     * @param {Function} callbacks.onPauseClick - toggle pause
     * @param {Function} callbacks.onEndGame    - quit / end game
     * @param {Function} callbacks.onUserChange - called with (user) on auth state change
     * @param {Object}   callbacks.dashboard    - dashboard instance with .show(user)
     */
    setupAuth(callbacks) {
        const { onLogsClick, onPauseClick, onEndGame, onUserChange, dashboard } = callbacks;

        // Login button
        if (this.btnLogin) {
            this.btnLogin.addEventListener('click', async (e) => {
                e.stopPropagation(); // Don't start game
                try {
                    await AuthService.login();
                } catch (err) {
                    console.error(err);
                    alert("Login Error: " + err.message);
                }
            });
        } else {
            console.warn("Login button not found in DOM");
        }

        // Logout button
        if (this.btnLogout) {
            this.btnLogout.addEventListener('click', async (e) => {
                e.stopPropagation();
                await AuthService.logout();
            });
        }

        // Logs button (start screen)
        if (this.btnLogs) {
            this.btnLogs.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onLogsClick) onLogsClick();
            });
        }

        // In-Game Logs Button
        this.btnIngameLogs = document.getElementById('ingame-logs-btn');
        if (this.btnIngameLogs) {
            this.btnIngameLogs.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onLogsClick) {
                    onLogsClick();
                } else {
                    alert("Please Login First!");
                }
            });
            this.btnIngameLogs.addEventListener('keydown', e => e.stopPropagation());
        }

        // End Game / Quit Button
        this.btnEndGame = document.getElementById('end-game-btn');
        if (this.btnEndGame) {
            this.btnEndGame.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onEndGame) onEndGame();
            });
            this.btnEndGame.addEventListener('keydown', e => e.stopPropagation());
        }

        // Pause Button
        this.btnPause = document.getElementById('pause-btn');
        if (this.btnPause) {
            this.btnPause.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onPauseClick) onPauseClick();
            });
            this.btnPause.addEventListener('keydown', e => e.stopPropagation());
        }

        // Auth state changes
        AuthService.onUserChange((user) => {
            if (onUserChange) onUserChange(user);

            if (user) {
                // Logged In
                this.btnLogin.style.display = 'none';
                this.userProfile.classList.remove('hidden');
                this.userProfile.style.display = 'flex';
                if (this.userName) this.userName.innerText = user.displayName || "Pilot";
                if (this.userAvatar) this.userAvatar.src = user.photoURL || `https://api.dicebear.com/9.x/initials/svg?seed=${user.uid}`;

                // Show Start Prompt
                this.startPrompt.classList.remove('hidden');
                this.startPrompt.style.display = 'block';

                // Save User Profile to DB (also triggers leaderboard backfill)
                TelemetryService.updateUserProfile(user);

                // Refresh leaderboard after backfill has time to complete
                setTimeout(() => this.fetchAndRenderLeaderboard(user.uid), 3000);
            } else {
                // Logged Out
                this.btnLogin.style.display = 'inline-block';
                this.userProfile.classList.add('hidden');
                this.userProfile.style.display = 'none';

                // Hide Start Prompt
                this.startPrompt.classList.add('hidden');
                this.startPrompt.style.display = 'none';
            }
        });
    }

    // ── Score / HUD updates ─────────────────────────────────────────────

    updateScore(score) {
        this.uiScore.innerText = score;
    }

    updateHighScore(highScore) {
        if (this.uiHighScore) this.uiHighScore.innerText = highScore;
    }

    updateLives(lives) {
        if (this.uiLives) this.uiLives.innerText = lives;
    }

    updateUI(score, highScore, lives) {
        this.updateScore(score);
        this.updateHighScore(highScore);
        this.updateLives(lives);
    }

    // ── Screen transitions ──────────────────────────────────────────────

    showStartScreen() {
        this.uiStartScreen.classList.remove('hidden');
        this.uiStartScreen.classList.add('visible');
        this.uiGameOverScreen.classList.add('hidden');
        this.uiGameOverScreen.classList.remove('visible');
    }

    hideStartScreen() {
        this.uiStartScreen.classList.add('hidden');
        this.uiStartScreen.classList.remove('visible');
    }

    showGameOverScreen(finalScore) {
        this.uiGameOverScreen.classList.remove('hidden');
        this.uiGameOverScreen.classList.add('visible');
        if (this.uiFinalScore) this.uiFinalScore.innerText = finalScore;
    }

    hideGameOverScreen() {
        this.uiGameOverScreen.classList.add('hidden');
        this.uiGameOverScreen.classList.remove('visible');
    }

    // ── Leaderboard ─────────────────────────────────────────────────────

    async fetchAndRenderLeaderboard(currentUid) {
        try {
            const data = await TelemetryService.getLeaderboard();
            this.renderLeaderboard(data, 'leaderboard-list', currentUid);
            this.renderLeaderboard(data, 'leaderboard-gameover-list', currentUid);
        } catch (e) {
            console.warn('Leaderboard fetch failed:', e);
        }
    }

    renderLeaderboard(data, elementId, currentUid) {
        const ol = document.getElementById(elementId);
        if (!ol) return;
        ol.innerHTML = '';

        if (!data || data.length === 0) {
            ol.innerHTML = '<li class="lb-loading">No scores yet. Be the first!</li>';
            return;
        }

        data.forEach(entry => {
            const li = document.createElement('li');
            if (entry.uid === currentUid) li.classList.add('lb-you');

            const name = document.createElement('span');
            name.className = 'lb-name';
            name.textContent = entry.displayName || 'Anonymous';

            const score = document.createElement('span');
            score.className = 'lb-score';
            score.textContent = entry.score.toLocaleString();

            li.appendChild(name);
            li.appendChild(score);
            ol.appendChild(li);
        });
    }

    // ── Mobile prompt swap ──────────────────────────────────────────────

    swapMobilePrompts(isMobile) {
        if (!isMobile) return;
        const desktopPrompt = document.getElementById('start-prompt');
        const mobilePrompt = document.getElementById('mobile-start-prompt');
        const restartPrompt = document.getElementById('restart-prompt');
        const mobileRestart = document.getElementById('mobile-restart-prompt');
        if (desktopPrompt) desktopPrompt.style.display = 'none';
        if (mobilePrompt) mobilePrompt.style.display = 'block';
        if (restartPrompt) restartPrompt.style.display = 'none';
        if (mobileRestart) mobileRestart.style.display = 'block';
    }
}
