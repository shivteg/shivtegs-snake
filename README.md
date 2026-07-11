# Shivtegs Snake 🐍

A retro-futuristic, multiplayer arcade Snake game with neon vibes and a clean modern aesthetic. Play solo, challenge a friend on the same keyboard, or connect across devices in real-time using PeerJS WebRTC technology!

![Shivtegs Snake Showcase](https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80) *(Visual representation of synthwave/neon style)*

## 🎮 Game Modes

1. **Single Player**: Classic arcade snake. Control the snake, eat glowing apples, grow as long as possible, and compete for high scores.
2. **Local 2-Player**: Compete with a friend on the same screen/keyboard.
   - **Player 1**: Control with `W`, `A`, `S`, `D` keys (Neon Cyan Snake).
   - **Player 2**: Control with `Arrow` keys (Neon Pink Snake).
3. **Play with Friend (Online)**: Start an online lobby, generate a unique invite link, and send it to your friend. Open it on different devices (even mobile/tablets) to play in the exact same game grid!
   - Player 1 (Host) controls the Cyan Snake.
   - Player 2 (Client) controls the Pink Snake.
   - Supports touch/D-pad controls for mobile device screens.

## ✨ Features

- **P2P Multiplayer**: Real-time multiplayer synchronization powered by WebRTC (PeerJS) without a heavy backend database.
- **Web Audio FX**: Built-in 8-bit synthetic sound effects generated dynamically using the browser's Web Audio API.
- **Interactive UI**: Responsive controls, clean retro fonts, neon glows, animated grid backgrounds, particle impact explosions, and smooth menu transitions.
- **Instant Join**: Direct room joins by pasting a share URL containing query params (e.g. `?room=YOUR_ROOM_ID`).

## 🛠️ How to Run Locally

You can run this project locally without any complex installation!

1. Clone or download this repository.
2. Open `index.html` directly in your browser.
3. *Alternatively*, run a local static web server to avoid CORS issues:
   ```bash
   npx serve .
   ```
   Or:
   ```bash
   python -m http.server 8000
   ```
4. Access the game at `http://localhost:8000` (or the port specified by your static server).

## 🚀 Deployment to GitHub Pages

To make it accessible online for mobile/remote devices:

1. Create a repository on GitHub named `shivtegs-snake`.
2. Push this code to the repository.
3. Go to repository **Settings** -> **Pages**.
4. Select the source branch (e.g., `main` or `master`) and save.
5. Your game will be live at `https://<your-username>.github.io/shivtegs-snake/`! Copy that link, and start hosting multiplayer lobbies!

---
*Created by Shivteg*

