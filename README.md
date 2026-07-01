---
title: Brand Grand Prix
emoji: 🏎️
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
---

# 🏎️ Brand Grand Prix

**Brand Grand Prix** is a fast-paced, real-time multiplayer 3D racing game set in a neon-lit cyberpunk city. Jump into a lobby, rev your engine, and race against other players to prove you are the fastest driver on the track!

## 🎮 How to Play

### The Objective
The race consists of **3 Laps** around the city circuit. The first player to cross the checkered finish line on their final lap wins the Grand Prix! 

### ⌨️ Controls
- **Accelerate:** Press the `UP Arrow` or `W` key to step on the gas.
- **Steer:** Use the `LEFT / RIGHT Arrows` or `A / D` keys to take sharp turns around the city blocks.
- **Brake / Reverse:** Press the `DOWN Arrow` or `S` key to slow down.
- **Look Around:** Click and drag your mouse on the screen to rotate the camera a full 360 degrees and check your blind spots!

### 🚦 The Race Experience
1. **The Lobby:** When you load the game, you enter the pre-race lobby. You can see how many other racers are currently online and waiting. Once everyone clicks "Join Race", the countdown begins!
2. **The Track:** Navigate hairpin turns and long straightaways. Be careful—if you steer too hard while going fast, your car will drift!
3. **The Scenery:** As you race, keep an eye out for massive skyscraper advertisements and the floating blimp overhead.
4. **The Podium:** When a racer completes 3 laps, the race ends for everyone. A massive podium screen will pop up, declaring the 1st, 2nd, and 3rd place winners, along with their final lap times and a message from the race sponsors!

---

## 🚀 Developers & Deployment
This game is fully open-source and built using **Three.js** (Frontend) and **Socket.io** (Backend) for instantaneous multiplayer syncing. 

### Run it Locally
1. Install dependencies: `npm run postinstall`
2. Start the server: `npm run build && npm start`
3. Play at `http://localhost:3001`

### Host it Online
The code is pre-configured with a `Dockerfile` and Vercel routing rules. You can upload the entire repository directly to **Hugging Face Spaces** for a free backend server, and optionally use **Vercel** to host the frontend!
