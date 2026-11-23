# Minimalist Pomodoro Clock

A clean, static, GitHub Pages-ready Pomodoro timer with automatic image-based color theming, auto-scanned artwork, Light/Dark mode, built-in Web Audio API sound effects, and state-based radio streams.

## Quick Start (Local)
1. Extract this folder to `/home/rishu/Downloads/pomodoro` (or anywhere you like).
2. Open `index.html` in your browser, or run `python3 -m http.server` inside the folder and open `http://localhost:8000` to preview dynamic colors and auto-scanned images locally.

## File Structure
- `index.html` — Page structure for the main clock and settings bento grid.
- `styles.css` — Visual styling, with the complete **Light and Dark color scheme** at the very top.
- `config.js` — Easy-to-edit settings (durations, radio stations, toggles, and offline fallback artwork).
- `theme.js` — Dynamic canvas color extraction for Light & Dark modes.
- `audio.js` — Built-in Web Audio API sound effects (Focus click, Break soft buzz, Clock tick) and radio stream player.
- `timer.js` — Drift-free Pomodoro countdown engine.
- `app.js` — Connects buttons, settings, tab title, auto-scanned image list, and `localStorage` saving.
- `assets/img/` — Drop your `.png`, `.jpg`, `.gif`, `.webp`, or `.svg` artwork files here.
- `scripts/scan-images.py` — Scans `assets/img/` and writes `assets/img/images.json`.
- `.github/workflows/deploy-pages.yml` — GitHub Actions workflow that auto-scans `assets/img/` and deploys to GitHub Pages on every push.

## Hosting on GitHub Pages (with Automatic Image Detection)
1. Push all files (including the `.github` folder) to a GitHub repository with `index.html` in the root.
2. In your repository on GitHub, open **Settings -> Pages -> Build and deployment**.
3. Under **Source**, choose **GitHub Actions** (instead of "Deploy from a branch").
4. Done! Whenever you upload or delete any `.png` / `.jpg` / `.gif` / `.webp` / `.svg` inside `assets/img/`, GitHub Actions automatically rebuilds `assets/img/images.json` and updates your live site within ~30 seconds.

## Local Refresh Tip (Optional)
If you add a new `.png` locally and preview via `python3 -m http.server`, run:
```bash
python3 scripts/scan-images.py
```
Opening `index.html` directly via `file://` automatically falls back to the `images` list in `config.js`.
