# 🚀 Quick Start Guide - Chess App

## Get Started in 3 Steps!

### 1️⃣ Install Dependencies
```bash
cd chess-app
npm install
```

### 2️⃣ Start MongoDB

**Option A: Local MongoDB**
```bash
mongod
```

**Option B: MongoDB Atlas (Cloud - Recommended)**
- Sign up at https://www.mongodb.com/cloud/atlas
- Create a free cluster
- Get connection string
- Update `.env.local` with your connection string:
  ```
  MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chess-app
  ```

### 3️⃣ Run the App
```bash
npm run dev
```

Visit http://localhost:3000 and start playing! ♟️

---

## First Time Setup

1. **Create Account**: Sign up with username and password
2. **Try Quick Match**: Click "Quick Match" → "10 Minutes"
3. **Or Add Friends**: Search for users, send requests, challenge them!

---

## Features at a Glance

✅ **Play with Friends** - Challenge your friends to chess matches  
✅ **Random Opponents** - Find opponents with matchmaking (1-min timeout)  
✅ **Multiple Time Controls** - 10min, 30min, 60min, custom, unlimited  
✅ **Real-time Gameplay** - Live moves with Socket.io  
✅ **Match History** - Replay all your past games  
✅ **ELO Ratings** - Track your skill level  

---

## Need Help?

Check the full **README.md** for:
- Complete setup instructions
- API documentation
- Troubleshooting
- Deployment guide

---

**Happy Playing! ♟️**
