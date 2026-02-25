export class AdController {
    constructor() {
        this.bottomBanner = document.getElementById('ad-container-bottom');
        this.gameOverAd = document.getElementById('ad-container-gameover');
        this.isAdSenseLoaded = false;

        // Initialize
        this.init();
    }

    init() {
        console.log("AdController Initialized");
        // Check if AdSense is already in head (inserted via index.html)
        if (document.querySelector('script[src*="adsbygoogle"]')) {
            this.isAdSenseLoaded = true;
        }
    }

    injectAdScript(publisherId) {
        // INSTRUCTIONS:
        // 1. You need a Publisher ID from Google AdSense (starts with 'ca-pub-')
        // 2. Call this method with your ID, or manually add the script tag in index.html

        if (this.isAdSenseLoaded) return;

        const script = document.createElement('script');
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
        script.async = true;
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
        this.isAdSenseLoaded = true;
        console.log("AdSense Script Injected");
    }

    showBottomBanner() {
        if (this.bottomBanner) {
            this.bottomBanner.style.display = 'block';
            // If using AdSense, you might need to push to adsbygoogle array here if not auto-ads
            // (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
    }

    hideBottomBanner() {
        if (this.bottomBanner) {
            this.bottomBanner.style.display = 'none';
        }
    }

    showGameOverAd() {
        // Call this when Game Over screen is shown
        if (this.gameOverAd) {
            this.gameOverAd.style.display = 'block';
            this.gameOverAd.classList.add('visible');

            // Example handling for refreshing ad if using a specific ad slot
            // try {
            //     (window.adsbygoogle = window.adsbygoogle || []).push({});
            // } catch (e) { console.error("Ad Error", e); }
        }
    }

    hideGameOverAd() {
        if (this.gameOverAd) {
            this.gameOverAd.style.display = 'none';
            this.gameOverAd.classList.remove('visible');
        }
    }
}
