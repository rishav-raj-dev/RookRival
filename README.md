# Chess App - Full-Stack Real-Time Chess Application

A modern, full-stack chess application built with Next.js 14, MongoDB, Socket.io, and TypeScript. Play chess with friends or random opponents with real-time gameplay, ELO ratings, and match history.

## 🎯 Features

### Authentication & Users
- ✅ JWT-based authentication with username/password
- ✅ Secure HTTP-only cookies
- ✅ User profiles with ELO ratings

### Friend System
- ✅ Search for users by username
- ✅ Send/accept/reject friend requests
- ✅ Challenge friends to games

### Game Modes
- ✅ Play with friends
- ✅ Random opponent matchmaking (with rating-based matching)
- ✅ Time controls: 10min, 30min, 60min, custom, or unlimited
- ✅ 1-minute matchmaking timeout

### Chess Features
- ✅ Real-time gameplay with Socket.io
- ✅ Legal move validation
- ✅ Checkmate, stalemate, and draw detection
- ✅ Captured pieces display
- ✅ Move history (PGN notation)
- ✅ Resignation
- ✅ Draw offers
- ✅ Timer countdown
- ✅ Special moves (castling, en passant, pawn promotion)

### Match History
- ✅ Complete game logs with date, opponent, result, time control
- ✅ Game replay functionality with move-by-move navigation
- ✅ View all past games

### Rating System
- ✅ ELO rating system
- ✅ Rating updates after each game
- ✅ Rating-based matchmaking

## 🛠 Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Backend**: Next.js API Routes, Custom Socket.io Server
- **Database**: MongoDB with Mongoose ORM
- **Real-time**: Socket.io
- **Chess Engine**: chess.js
- **UI Components**: react-chessboard, Tailwind CSS, shadcn/ui
- **State Management**: Zustand
- **Authentication**: JWT with bcryptjs

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB (local installation or MongoDB Atlas account)
- npm or yarn

## 🚀 Installation & Setup

### 1. Clone or Extract the Project

```bash
cd chess-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up MongoDB

**Option A: Local MongoDB**
- Install MongoDB from https://www.mongodb.com/try/download/community
- Start MongoDB service:
  ```bash
  # macOS/Linux
  mongod
  
  # Windows
  # MongoDB should start automatically as a service
  ```

**Option B: MongoDB Atlas (Cloud)**
- Create a free account at https://www.mongodb.com/cloud/atlas
- Create a new cluster
- Get your connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/dbname`)
- Update `.env.local` with your connection string

### 4. Configure Environment Variables

The `.env.local` file is already created with default values:

```env
MONGODB_URI=mongodb://localhost:27017/chess-app
JWT_SECRET=super-secret-jwt-key-for-development-change-in-production
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
```

**For MongoDB Atlas, update MONGODB_URI:**
```env
MONGODB_URI=mongodb+srv://your-username:your-password@cluster.mongodb.net/chess-app
```

**For Production, change JWT_SECRET to a random secure string:**
```env
JWT_SECRET=your-super-secure-random-string-here
```

### 5. Run the Development Server

```bash
npm run dev
```

The application will be available at http://localhost:3000

## 📱 Usage Guide

### 1. Create an Account
- Navigate to http://localhost:3000
- Click "Sign up"
- Enter username (3-20 characters) and password (6+ characters)

### 2. Play a Game

**Option A: Random Opponent**
- From dashboard, click "Quick Match"
- Choose time control (10min, 30min, 60min, unlimited)
- Wait up to 60 seconds for matchmaking
- Game starts automatically when opponent is found

**Option B: Challenge a Friend**
- Click "Friends" from dashboard
- Search for users by username
- Send friend request
- Once accepted, click "Challenge" next to friend's name
- Choose time control
- Game starts immediately

### 3. During the Game
- Make moves by dragging pieces
- View timer countdown
- See captured pieces
- View move history
- Offer draw or resign

### 4. View Match History
- Click "Match History" from dashboard
- See all completed games
- Click "Replay" to watch any game move-by-move
- Navigate through moves with Previous/Next buttons

## 🎮 Game Controls

### In-Game Actions
- **Move Pieces**: Drag and drop pieces on the board
- **Offer Draw**: Click "Offer Draw" button
- **Resign**: Click "Resign" button
- **Accept Draw**: Appears when opponent offers draw

### Replay Controls
- **Next**: View next move
- **Previous**: View previous move
- **Skip to Start**: ⏮ button
- **Skip to End**: ⏭ button

## 🏗 Project Structure

```
chess-app/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── auth/        # Authentication endpoints
│   │   │   ├── friends/     # Friend system endpoints
│   │   │   ├── games/       # Game endpoints
│   │   │   ├── matchmaking/ # Matchmaking endpoints
│   │   │   └── users/       # User endpoints
│   │   ├── components/      # Reusable UI components
│   │   ├── dashboard/       # Dashboard page
│   │   ├── friends/         # Friends page
│   │   ├── game/            # Game page with chess board
│   │   ├── history/         # Match history page
│   │   ├── login/           # Login page
│   │   ├── signup/          # Signup page
│   │   ├── globals.css      # Global styles
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Home page
│   ├── lib/
│   │   ├── auth.ts          # JWT utilities
│   │   ├── db.ts            # MongoDB connection
│   │   ├── socket.ts        # Socket.io server logic
│   │   └── utils.ts         # Utility functions
│   ├── models/
│   │   ├── User.ts          # User model
│   │   └── Game.ts          # Game model
│   ├── store/
│   │   └── index.ts         # Zustand state management
│   ├── types/
│   │   └── index.ts         # TypeScript types
│   └── utils/
│       └── elo.ts           # ELO rating calculations
├── server.js                # Custom server with Socket.io
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── next.config.js
└── .env.local              # Environment variables
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Friends
- `GET /api/friends` - Get friends list and pending requests
- `POST /api/friends/send-request` - Send friend request
- `POST /api/friends/respond` - Accept/reject friend request
- `POST /api/friends/challenge` - Challenge friend to game

### Users
- `GET /api/users/search?q={query}` - Search users by username

### Matchmaking
- `POST /api/matchmaking` - Join matchmaking queue
- `DELETE /api/matchmaking` - Leave matchmaking queue

### Games
- `GET /api/games/{id}` - Get game details
- `GET /api/games/history` - Get user's game history

## 🔌 Socket.io Events

### Client → Server
- `join-game` - Join a game room
- `make-move` - Make a chess move
- `resign` - Resign from game
- `offer-draw` - Offer draw to opponent
- `accept-draw` - Accept draw offer
- `time-update` - Update time remaining

### Server → Client
- `game-state` - Initial game state
- `move-made` - Move was made
- `game-over` - Game ended
- `draw-offered` - Opponent offered draw
- `time-updated` - Time updated
- `error` - Error message

## 🎨 UI Design

The app features a **modern, minimal design** with:
- Clean white cards on light gray background
- Smooth transitions and hover effects
- Responsive layout (works on mobile and desktop)
- Intuitive chess board with drag-and-drop
- Real-time timer countdown
- Clear game status indicators

## 🔐 Security Features

- ✅ Passwords hashed with bcryptjs
- ✅ JWT tokens in HTTP-only cookies
- ✅ Protected API routes
- ✅ Input validation
- ✅ SQL injection prevention (MongoDB)
- ✅ XSS protection

## 🧪 Testing the Application

### Test Scenario 1: Friend Game
1. Create two accounts (User A and User B)
2. User A searches for User B
3. User A sends friend request
4. User B accepts request
5. User A challenges User B
6. Both users play the game
7. Check match history for both users

### Test Scenario 2: Random Matchmaking
1. Open two browser windows (or incognito + normal)
2. Login with different accounts in each
3. Both click "Quick Match" → "10 Minutes"
4. Game should start within seconds
5. Play and test all features

## 📝 Notes

- **Matchmaking Queue**: Currently in-memory (resets on server restart). For production, use Redis.
- **Socket.io**: Custom server required for Socket.io integration with Next.js
- **Time Controls**: Unlimited time = 999,999 seconds
- **ELO K-Factor**: Set to 32 (standard value)
- **Rating Range**: ±200 points for matchmaking

## 🐛 Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
mongod --version

# Start MongoDB
mongod
```

### Port Already in Use
```bash
# Kill process on port 3000
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Socket.io Connection Fails
- Ensure custom server is running (npm run dev)
- Check NEXT_PUBLIC_SOCKET_URL in .env.local
- Clear browser cache and cookies

## 🚢 Deployment

### Recommended: Vercel + MongoDB Atlas

1. **Deploy to Vercel**:
   ```bash
   npm run build
   vercel deploy
   ```

2. **Set Environment Variables** in Vercel dashboard:
   - `MONGODB_URI` (MongoDB Atlas connection string)
   - `JWT_SECRET` (secure random string)
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL)
   - `NEXT_PUBLIC_SOCKET_URL` (your Vercel URL)

3. **Note**: Socket.io requires WebSocket support. Vercel supports this, but you may need to configure it.

### Alternative: Railway, Render, or Heroku

All support Node.js and WebSockets. Follow their respective deployment guides.

## 📄 License

MIT License - feel free to use this project for learning or your own applications!

## 🤝 Contributing

This is a complete, production-ready chess application. Feel free to fork and enhance!

## 📞 Support

For issues or questions, please create an issue in the repository.

---

**Built with ❤️ using Next.js, Socket.io, and chess.js**
