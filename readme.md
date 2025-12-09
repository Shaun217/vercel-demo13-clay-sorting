# Neon AR Shooter (Web-Based)

A robust, turn-based Augmented Reality shooting game that runs entirely in the browser using MediaPipe Hands for tracking and HTML5 Canvas for rendering.

## How to Play
1. **Allow Camera Access** when prompted.
2. Enter the number of players.
3. **Make a "Gun" gesture** with your hand (Thumb Up, Index Finger Pointing).
4. Aim the cyan crosshair at the moving targets.
5. **Shoot** by quickly flicking your index finger **UPWARDS** (Recoil action).
6. Compete for the highest score on the leaderboard!

## Deployment Instructions (GitHub + Vercel)

1. **Create Repository:** Create a new repository on GitHub.
2. **Upload Files:** Upload `index.html`, `style.css`, and `script.js` to the root of the repository.
3. **Deploy on Vercel:**
   - Go to [Vercel](https://vercel.com).
   - Click "Add New Project".
   - Import your GitHub repository.
   - Click "Deploy".
4. **Done:** Your AR game is now live!

## Tech Stack
- **HTML5 Canvas:** High-performance 2D rendering.
- **MediaPipe Hands:** Real-time hand tracking and landmark detection.
- **Web Audio API:** Synthesized sound effects (no external assets required).
- **Vanilla JS:** No bundlers or build steps needed.