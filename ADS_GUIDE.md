# How to Activate Display Ads in Neon Asteroids

I have integrated the **structure** for displaying ads into your game. Currently, there are placeholders visible in the **Start Screen**, **Game Over Screen**, and a **Bottom Banner**.

To start showing real ads and earning revenue, follow these steps:

## 1. Sign Up for an Ad Network
The most common network for web games is **Google AdSense**.
- Go to [Google AdSense](https://adsense.google.com/) and sign up.
- Add your site (domain) to AdSense and get it approved.

## 2. Get Your Publisher ID & Script
**STATUS: DONE**
I have already added the main AdSense script to your `index.html`.

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3757292993837136" crossorigin="anonymous"></script>
```

## 3. Create Ad Units
In the AdSense dashboard:
1.  Go to **Ads > By ad unit**.
2.  Create a **Display ad**.
3.  Name it "Neon Asteroids Game Over" (Fixed size: 300x250 or Responsive).
4.  Copy the code snippet (the `<ins>` tag).
5.  Create another unit "Neon Asteroids Banner" (Leaderboard 728x90).
6.  Copy its code snippet.

## 4. Paste Code in `index.html`
Open `index.html` and look for the comments I added:

### Game Over Ad
Find `<div id="ad-container-gameover">`. Replace the placeholder `<div>` with your AdSense `<ins>` code:

```html
<div id="ad-container-gameover" ...>
    <!-- PASTE YOUR 300x250 AD UNIT CODE HERE -->
    <ins class="adsbygoogle"
         style="display:inline-block;width:300px;height:250px"
         data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
         data-ad-slot="1234567890"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>
```

### Bottom Banner Ad
Find `<div id="ad-container-bottom">`. Replace the placeholder with your Leaderboard code:

```html
<div id="ad-container-bottom" ...>
    <!-- PASTE YOUR 728x90 AD UNIT CODE HERE -->
    <ins class="adsbygoogle"
         style="display:inline-block;width:728px;height:90px"
         data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
         data-ad-slot="0987654321"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>
```

## 5. Important Notes
- **Localhost**: Ads usually do not show up on `localhost`. You need to deploy the game to a real domain (like your `neon-asteroids.izzytchai.com`) for ads to appear.
- **Ad Blockers**: If you have an ad blocker, you won't see the ads (or checks). Disable it for testing.
- **Privacy Policy**: AdSense requires a Privacy Policy link on your site.
