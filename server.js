require('dotenv').config({ path: '.env' });

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');
const mongoose = require('mongoose');

// Load CommonJS models for socket handlers
const User = require('./models/User');
const Game = require('./models/Game');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const games = new Map();

// Connect to MongoDB
const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chess-app');
      console.log('📦 MongoDB connected');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};

connectDB();

// Elo rating calculation (Chess.com style - K-factor of 32)
function calculateEloRating(winnerRating, loserRating, isDraw = false, kFactor = 32) {
  // Expected scores
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));

  let actualWinner, actualLoser;
  if (isDraw) {
    actualWinner = 0.5;
    actualLoser = 0.5;
  } else {
    actualWinner = 1;
    actualLoser = 0;
  }

  // Calculate new ratings
  const newWinnerRating = Math.round(winnerRating + kFactor * (actualWinner - expectedWinner));
  const newLoserRating = Math.round(loserRating + kFactor * (actualLoser - expectedLoser));

  return { newWinnerRating, newLoserRating };
}

// Update player ratings after game ends
async function updatePlayerRatings(game, winner, isDraw = false) {
  try {
    const UserModel = User;
    const whiteUser = await UserModel.findById(game.whitePlayer._id || game.whitePlayer);
    const blackUser = await UserModel.findById(game.blackPlayer._id || game.blackPlayer);

    if (!whiteUser || !blackUser) {
      console.error('❌ Could not find users for rating update');
      return;
    }

    const whiteRating = whiteUser.rating || 1200;
    const blackRating = blackUser.rating || 1200;

    console.log(`📊 Before - White: ${whiteRating}, Black: ${blackRating}`);

    if (isDraw) {
      // Draw - both players exchange rating points based on expected outcome
      const { newWinnerRating, newLoserRating } = calculateEloRating(whiteRating, blackRating, true);
      whiteUser.rating = newWinnerRating;
      blackUser.rating = newLoserRating;
    } else if (winner) {
      // Someone won - calculate rating changes
      const isWhiteWinner = (winner._id || winner).toString() === (game.whitePlayer._id || game.whitePlayer).toString();
      const { newWinnerRating, newLoserRating } = calculateEloRating(
        isWhiteWinner ? whiteRating : blackRating,
        isWhiteWinner ? blackRating : whiteRating,
        false
      );

      if (isWhiteWinner) {
        whiteUser.rating = newWinnerRating;
        blackUser.rating = newLoserRating;
      } else {
        blackUser.rating = newWinnerRating;
        whiteUser.rating = newLoserRating;
      }
    }

    await whiteUser.save();
    await blackUser.save();

    console.log(`📊 After - White: ${whiteUser.rating} (${whiteUser.rating - whiteRating > 0 ? '+' : ''}${whiteUser.rating - whiteRating}), Black: ${blackUser.rating} (${blackUser.rating - blackRating > 0 ? '+' : ''}${blackUser.rating - blackRating})`);
  } catch (error) {
    console.error('❌ Error updating player ratings:', error);
  }
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // User joins their personal room for notifications
    socket.on('join-user', (userId) => {
      socket.join(`${userId}`);
      console.log(`User ${userId} joined personal room`);
    });

    // Friend request notifications
    socket.on('send-friend-request', ({ targetUserId }) => {
      io.to(`${targetUserId}`).emit('friend-request-received');
      console.log(`Friend request notification sent to user ${targetUserId}`);
    });

    socket.on('friend-request-response', ({ targetUserId, action, message }) => {
      const event = action === 'accept' ? 'friend-request-accepted' : 'friend-request-rejected';
      io.to(`${targetUserId}`).emit(event, {message});
      console.log(`Friend request ${action} notification sent to user ${targetUserId}`);
    });

    // Send challenge notification
    socket.on('send-challenge', async ({ challengeId, challengedUserId, message }) => {
      io.to(`${challengedUserId}`).emit('challenge-received', { message });
      console.log(`Challenge ${challengeId} sent to user ${challengedUserId}`);
    });

    // Notify when challenge is accepted/rejected
    socket.on('challenge-response', async ({ challengerId, action, gameId }) => {
      const event = action === 'accept' ? 'challenge-accepted' : 'challenge-rejected';
      const roomName = `${challengerId}`;
      const socketsInRoom = await io.in(roomName).allSockets();
      console.log(`📢 Emitting ${event} to ${roomName}`);
      console.log(`   - Sockets in room: ${socketsInRoom.size}`);
      console.log(`   - GameId:`, gameId);
      io.to(roomName).emit(event, { gameId });
      console.log(`✅ Challenge ${action} notification sent to challenger ${challengerId}`);
    });

    socket.on('join-game', async ({ gameId, userId }) => {
      try {
        const GameModel = Game;
        const gameData = await GameModel.findById(gameId)
          .populate('whitePlayer', 'username rating')
          .populate('blackPlayer', 'username rating');

        if (!gameData) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        socket.join(gameId);

        if (!games.has(gameId)) {
          const chess = new Chess();
          if (gameData.moves && gameData.moves.length > 0) {
            gameData.moves.forEach(move => chess.move(move));
          }
          games.set(gameId, { chess, players: new Set() });
        }

        const game = games.get(gameId);
        game.players.add(userId);

        const isGameOver = gameData?.status === 'completed';
        
        io.to(gameId).emit('game-state', {
          fen: game.chess.fen(),
          turn: game.chess.turn(),
          isCheck: game.chess.isCheck(),
          isCheckmate: game.chess.isCheckmate(),
          isStalemate: game.chess.isStalemate(),
          isDraw: game.chess.isDraw(),
          isGameOver: isGameOver,
          whiteTimeRemaining: gameData.whiteTimeRemaining || 0,
          blackTimeRemaining: gameData.blackTimeRemaining || 0,
          gameData: gameData
        });

        console.log(`✅ User ${userId} joined game ${gameId}`);
      } catch (error) {
        console.error('Error joining game:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });

    socket.on('make-move', async ({ gameId, move, userId }) => {
      try {
        const GameModel = Game;
        const gameData = await GameModel.findById(gameId)
          .populate('whitePlayer', 'username rating')
          .populate('blackPlayer', 'username rating');

        if (!gameData || gameData.status !== 'active') {
          socket.emit('error', { message: 'Game is not active' });
          return;
        }
        
        // Get or recreate game from memory
        let game = games.get(gameId);
        if (!game) {
          const chess = new Chess();
          if (gameData.moves && gameData.moves.length > 0) {
            gameData.moves.forEach(m => chess.move(m));
          }
          game = { chess, players: new Set() };
          games.set(gameId, game);
          console.log('♻️ Recreated game in memory:', gameId);
        }

        if (!gameData.whitePlayer || !gameData.blackPlayer) {
          socket.emit('error', { message: 'Game data is incomplete' });
          return;
        }
        // console.log(`game data: `, gameData);
        const whitePlayerId = (gameData.whitePlayer._id).toString();
        const blackPlayerId = (gameData.blackPlayer._id).toString();
        const userIdStr = userId.toString();
        const userColor = whitePlayerId === userIdStr ? 'w' : 'b';
        
        console.log(`🎮 Move attempt - User: ${userIdStr}, White: ${whitePlayerId}, Black: ${blackPlayerId}, Color: ${userColor}, Turn: ${game.chess.turn()}`);
        
        if (game.chess.turn() !== userColor) {
          socket.emit('error', { message: 'Not your turn' });
          return;
        }

        const result = game.chess.move(move);
        if (!result) {
          socket.emit('error', { message: 'Invalid move' });
          return;
        }

        // Update captured pieces
        if (result.captured) {
          const color = result.color === 'w' ? 'white' : 'black';
          if (!game.capturedPieces) {
            game.capturedPieces = { white: [], black: [] };
          }
          game.capturedPieces[color].push(result.captured);
        }
        console.log('Captured pieces:', game.capturedPieces);

        // Update game data in DB
        gameData.capturedPieces = game.capturedPieces;

        gameData.moves.push(result.san);
        gameData.currentFen = game.chess.fen();

        if (game.chess.isGameOver()) {
          gameData.status = 'completed';
          
          if (game.chess.isCheckmate()) {
            const winnerPlayer = game.chess.turn() === 'w' ? gameData.blackPlayer : gameData.whitePlayer;
            gameData.winner = winnerPlayer._id || winnerPlayer;
            gameData.result = game.chess.turn() === 'w' ? 'black' : 'white';
            
            await updatePlayerRatings(gameData, winnerPlayer, false);
          } else if (game.chess.isDraw() || game.chess.isStalemate()) {
            gameData.result = 'draw';
            await updatePlayerRatings(gameData, null, true);
          }
        }

        await gameData.save();

        const isGameOver = gameData?.status === 'completed';

        io.to(gameId).emit('move-made', {
          move: result,
          fen: game.chess.fen(),
          turn: game.chess.turn(),
          isCheck: game.chess.isCheck(),
          isCheckmate: game.chess.isCheckmate(),
          isStalemate: game.chess.isStalemate(),
          isDraw: game.chess.isDraw(),
          isGameOver: isGameOver,
        });

        if (game.chess.isCheckmate()) {
          const winner = game.chess.turn() === 'w' ? 'black' : 'white';
          io.to(gameId).emit('game-over', { 
            winner, 
            reason: 'checkmate',
            gameData: await GameModel.findById(gameId)
              .populate('whitePlayer', 'username rating')
              .populate('blackPlayer', 'username rating')
          });
        } else if (game.chess.isDraw()) {
          io.to(gameId).emit('game-over', { 
            winner: null, 
            reason: 'draw',
            gameData: await GameModel.findById(gameId)
              .populate('whitePlayer', 'username rating')
              .populate('blackPlayer', 'username rating')
          });
        } else if (game.chess.isStalemate()) {
          io.to(gameId).emit('game-over', { 
            winner: null, 
            reason: 'stalemate',
            gameData: await GameModel.findById(gameId)
              .populate('whitePlayer', 'username rating')
              .populate('blackPlayer', 'username rating')
          });
        }

        console.log(`♟️ Move made in game ${gameId}:`, move);
      } catch (error) {
        console.error('Error making move:', error);
        socket.emit('error', { message: 'Failed to make move' });
      }
    });

    socket.on('resign', async ({ gameId, userId }) => {
      try {
        const GameModel = Game;
        const gameData = await GameModel.findById(gameId)
          .populate('whitePlayer', 'username rating')
          .populate('blackPlayer', 'username rating');

        if (!gameData || gameData.status !== 'active') {
          socket.emit('error', { message: 'Game is not active' });
          return;
        }

        const resigningPlayer = gameData.whitePlayer._id.toString() === userId ? 'white' : 'black';
        const winnerPlayer = resigningPlayer === 'white' ? gameData.blackPlayer : gameData.whitePlayer;

        gameData.status = 'completed';
        gameData.result = resigningPlayer === 'white' ? 'black' : 'white';
        gameData.winner = winnerPlayer._id || winnerPlayer;
        gameData.endReason = 'resignation';

        await updatePlayerRatings(gameData, winnerPlayer, false);
        await gameData.save();

        io.to(gameId).emit('player-resigned', {
          userId,
          currentGame: await GameModel.findById(gameId)
            .populate('whitePlayer', 'username rating')
            .populate('blackPlayer', 'username rating'),
        });

        console.log(`🏳️ Player ${userId} resigned in game ${gameId}`);
      } catch (error) {
        console.error('Error handling resignation:', error);
        socket.emit('error', { message: 'Failed to resign' });
      }
    });

    socket.on('offer-draw', async ({ gameId, userId }) => {
      try {
        const GameModel = Game;
        const gameData = await GameModel.findById(gameId);

        if (!gameData || gameData.status !== 'active') {
          socket.emit('error', { message: 'Game is not active' });
          return;
        }

        const offeringPlayer = gameData.whitePlayer.toString() === userId ? 'white' : 'black';
        
        socket.to(gameId).emit('draw-offered', {
          offeredBy: offeringPlayer
        });

        console.log(`🤝 Draw offered by ${offeringPlayer} in game ${gameId}`);
      } catch (error) {
        console.error('Error offering draw:', error);
        socket.emit('error', { message: 'Failed to offer draw' });
      }
    });

    socket.on('accept-draw', async ({ gameId }) => {
      try {
        const GameModel = Game;
        const gameData = await GameModel.findById(gameId)
          .populate('whitePlayer', 'username rating')
          .populate('blackPlayer', 'username rating');

        if (!gameData || gameData.status !== 'active') {
          socket.emit('error', { message: 'Game is not active' });
          return;
        }

        gameData.status = 'completed';
        gameData.result = 'draw';
        gameData.endReason = 'draw';

        await updatePlayerRatings(gameData, null, true);
        await gameData.save();

        io.to(gameId).emit('draw-accepted', {
          gameData: await GameModel.findById(gameId)
            .populate('whitePlayer', 'username rating')
            .populate('blackPlayer', 'username rating')
        });

        console.log(`🤝 Draw accepted in game ${gameId}`);
      } catch (error) {
        console.error('Error accepting draw:', error);
        socket.emit('error', { message: 'Failed to accept draw' });
      }
    });

    socket.on('decline-draw', ({ gameId }) => {
      socket.to(gameId).emit('draw-declined');
      console.log(`❌ Draw declined in game ${gameId}`);
    });

    socket.on('time-update', async ({ gameId, whiteTime, blackTime }) => {
      try {
        const GameModel = Game;
        await GameModel.findByIdAndUpdate(gameId, {
          whiteTimeRemaining: whiteTime,
          blackTimeRemaining: blackTime
        });
        
        // Broadcast updated time to all clients in the game
        io.to(gameId).emit('time-sync', {
          whiteTime,
          blackTime
        });
      } catch (error) {
        console.error('Error updating time:', error);
      }
    });

    socket.on('request-sync', async ({ gameId }) => {
      try {
        const GameModel = Game;
        const gameData = await GameModel.findById(gameId)
          .populate('whitePlayer', 'username rating')
          .populate('blackPlayer', 'username rating');

        if (!gameData) return;

        // Get or recreate game from memory
        let game = games.get(gameId);
        if (!game) {
          const chess = new Chess();
          if (gameData.moves && gameData.moves.length > 0) {
            gameData.moves.forEach(m => chess.move(m));
          }
          game = { chess, players: new Set() };
          games.set(gameId, game);
        }

        const isGameOver = gameData?.status === 'completed';
        
        // Send current state to requesting client
        socket.emit('game-state', {
          fen: game.chess.fen(),
          turn: game.chess.turn(),
          isCheck: game.chess.isCheck(),
          isCheckmate: game.chess.isCheckmate(),
          isStalemate: game.chess.isStalemate(),
          isDraw: game.chess.isDraw(),
          isGameOver: isGameOver,
          whiteTimeRemaining: gameData.whiteTimeRemaining || 0,
          blackTimeRemaining: gameData.blackTimeRemaining || 0,
          gameData: gameData
        });
      } catch (error) {
        console.error('Error syncing game state:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id);
    });
  });

  server.listen(port, () => {
    console.log(`🚀 Server ready on http://${hostname}:${port}`);
  });
});
