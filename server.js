const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');
const mongoose = require('mongoose');

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
    const UserModel = mongoose.connection.models.User || require('./src/models/User').default;
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
    },
  });

  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    // User joins their personal room for notifications
    socket.on('join-user', (userId) => {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined personal room`);
    });

    // Friend request notifications
    socket.on('send-friend-request', ({ targetUserId }) => {
      io.to(`user:${targetUserId}`).emit('friend-request-received');
      console.log(`Friend request notification sent to user ${targetUserId}`);
    });

    socket.on('friend-request-response', ({ targetUserId, action }) => {
      const event = action === 'accept' ? 'friend-request-accepted' : 'friend-request-rejected';
      io.to(`user:${targetUserId}`).emit(event);
      console.log(`Friend request ${action} notification sent to user ${targetUserId}`);
    });

    // Send challenge notification
    socket.on('send-challenge', async ({ challengeId, challengedUserId }) => {
      io.to(`user:${challengedUserId}`).emit('challenge-received', { challengeId });
      console.log(`Challenge ${challengeId} sent to user ${challengedUserId}`);
    });

    // Notify when challenge is accepted/rejected
    socket.on('challenge-response', async ({ challengerId, action, gameId }) => {
      const event = action === 'accept' ? 'challenge-accepted' : 'challenge-rejected';
      const roomName = `user:${challengerId}`;
      const socketsInRoom = await io.in(roomName).allSockets();
      console.log(`📢 Emitting ${event} to ${roomName}`);
      console.log(`   - Sockets in room: ${socketsInRoom.size}`);
      console.log(`   - GameId:`, gameId);
      io.to(roomName).emit(event, { gameId });
      console.log(`✅ Challenge ${action} notification sent to challenger ${challengerId}`);
    });

    socket.on('join-game', async (gameId) => {
      socket.join(gameId);
      
      try {
        const mongoose = require('mongoose');
        let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Default starting position
        let gameData = null;
        
        // Try to get game state from database
        if (mongoose.connection.readyState === 1) {
          const GameModel = mongoose.connection.models.Game || require('./src/models/Game').default;
          gameData = await GameModel.findById(gameId)
            .populate('whitePlayer', 'username rating')
            .populate('blackPlayer', 'username rating');
          
          if (gameData && gameData.fen) {
            fen = gameData.fen;
            console.log(`Loading game ${gameId} from DB with FEN: ${fen.substring(0, 20)}...`);
          }
        }
        
        // Always update or create the chess instance with the current FEN
        const chess = new Chess(fen);
        games.set(gameId, chess);
        
        // Send complete game state
        const isGameOver = gameData?.status === 'completed';
        socket.emit('game-state', {
          fen: chess.fen(),
          turn: chess.turn(),
          gameOver: isGameOver,
          moves: gameData?.moves || [],
          capturedPieces: gameData?.capturedPieces || { white: [], black: [] },
          whiteTimeRemaining: gameData?.whiteTimeRemaining || 600,
          blackTimeRemaining: gameData?.blackTimeRemaining || 600,
          status: gameData?.status,
          winner: gameData?.winner,
          endReason: gameData?.endReason,
        });

        console.log(`User joined game: ${gameId}, Moves: ${gameData?.moves?.length || 0}, Status: ${gameData?.status}`);
      } catch (error) {
        console.error('Join game error:', error);
        
        // Fallback: create default chess instance
        const chess = new Chess();
        games.set(gameId, chess);

        socket.emit('game-state', {
          fen: chess.fen(),
          turn: chess.turn(),
          gameOver: chess.isGameOver(),
          moves: [],
          capturedPieces: { white: [], black: [] },
        });

        console.log(`User joined game: ${gameId} (fallback)`);
      }
    });

    socket.on('make-move', async ({ gameId, move }) => {
      const chess = games.get(gameId);
      if (!chess) {
        socket.emit('error', 'Game not found');
        return;
      }

      try {
        const result = chess.move(move);
        if (result) {
          console.log('Move made:', result.san);
          
          // Build the move history from the chess instance
          const moveHistory = chess.history();
          console.log('Move history:', moveHistory);
          
          // Update the database with the move
          const mongoose = require('mongoose');
          let capturedPieces = { white: [], black: [] };
          
          if (mongoose.connection.readyState === 1) {
            try {
              const GameModel = mongoose.connection.models.Game || require('./src/models/Game').default;
              const game = await GameModel.findById(gameId);
              if (game) {
                game.moves.push(result.san);
                game.fen = chess.fen();
                if (result.captured) {
                  const color = result.color === 'w' ? 'white' : 'black';
                  game.capturedPieces[color].push(result.captured);
                }
                
                // Check if game is over (checkmate, stalemate, draw)
                if (chess.isGameOver()) {
                  game.status = 'completed';
                  game.endedAt = new Date();
                  
                  if (chess.isCheckmate()) {
                    game.endReason = 'checkmate';
                    // Winner is the player who just moved (opposite of current turn)
                    game.winner = chess.turn() === 'w' ? game.blackPlayer : game.whitePlayer;
                    game.result = chess.turn() === 'w' ? 'black' : 'white';
                    console.log(`🏆 Game ${gameId} ended by checkmate. Winner: ${game.result}, Status: ${game.status}`);
                    // Update Elo ratings
                    await updatePlayerRatings(game, game.winner, false);
                  } else if (chess.isStalemate()) {
                    game.endReason = 'stalemate';
                    game.result = 'draw';
                    game.winner = null;
                    console.log(`🤝 Game ${gameId} ended in stalemate`);
                    // Update Elo ratings for draw
                    await updatePlayerRatings(game, null, true);
                  } else if (chess.isDraw()) {
                    game.endReason = 'draw';
                    game.result = 'draw';
                    game.winner = null;
                    console.log(`🤝 Game ${gameId} ended in draw`);
                    // Update Elo ratings for draw
                    await updatePlayerRatings(game, null, true);
                  }
                }
                
                await game.save();
                console.log(`💾 Game saved. Status: ${game.status}, EndReason: ${game.endReason}`);
                capturedPieces = game.capturedPieces;
                
                console.log('Game updated in DB. Moves:', game.moves.length);
                io.to(gameId).emit('move-made', {
                  move: result,
                  fen: chess.fen(),
                  turn: chess.turn(),
                  gameOver: chess.isGameOver(),
                  isCheckmate: chess.isCheckmate(),
                  isStalemate: chess.isStalemate(),
                  isDraw: chess.isDraw(),
                  capturedPieces: game.capturedPieces,
                  moves: game.moves,
                });
                return;
              }
            } catch (dbError) {
              console.error('Database error:', dbError);
            }
          }
          
          // Fallback: send move without DB data
          io.to(gameId).emit('move-made', {
            move: result,
            fen: chess.fen(),
            turn: chess.turn(),
            gameOver: chess.isGameOver(),
            isCheckmate: chess.isCheckmate(),
            isStalemate: chess.isStalemate(),
            isDraw: chess.isDraw(),
            capturedPieces,
            moves: moveHistory,
          });
        } else {
          socket.emit('error', 'Invalid move');
        }
      } catch (error) {
        console.error('Move error:', error);
        socket.emit('error', 'Invalid move');
      }
    });

    socket.on('resign', async ({ gameId, userId }) => {
      console.log(`Player ${userId} resigned from game ${gameId}`);
      
      // Update game in database
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
          const GameModel = mongoose.connection.models.Game || require('./src/models/Game').default;
          const game = await GameModel.findById(gameId);
          if (game) {
            game.status = 'completed';
            game.endedAt = new Date();
            game.endReason = 'resignation';
            // Winner is the opposite player
            game.winner = game.whitePlayer.toString() === userId ? game.blackPlayer : game.whitePlayer;
            // Update Elo ratings
            await updatePlayerRatings(game, game.winner, false);
            await game.save();
            console.log(`Game ${gameId} ended by resignation`);
          }
        }
      } catch (error) {
        console.error('Error updating game on resignation:', error);
      }
      
      io.to(gameId).emit('player-resigned', { userId });
    });

    socket.on('offer-draw', ({ gameId, userId }) => {
      console.log(`Draw offered in game ${gameId} by user ${userId}`);
      socket.to(gameId).emit('draw-offered');
    });

    socket.on('accept-draw', async ({ gameId }) => {
      console.log(`Draw accepted in game ${gameId}`);
      
      // Update game in database
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
          const GameModel = mongoose.connection.models.Game || require('./src/models/Game').default;
          const game = await GameModel.findById(gameId);
          if (game) {
            game.status = 'completed';
            game.endedAt = new Date();
            game.endReason = 'draw';
            game.result = 'draw';
            game.winner = null;
            // Update Elo ratings for draw
            await updatePlayerRatings(game, null, true);
            await game.save();
            console.log(`Game ${gameId} ended in draw`);
          }
        }
      } catch (error) {
        console.error('Error updating game on draw:', error);
      }
      
      io.to(gameId).emit('draw-accepted');
    });

    socket.on('time-update', async ({ gameId, whiteTime, blackTime }) => {
      // Broadcast to ALL clients in the game room (including sender)
      io.to(gameId).emit('time-updated', { whiteTime, blackTime });
      
      // Update time in database
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
          const GameModel = mongoose.connection.models.Game || require('./src/models/Game').default;
          const game = await GameModel.findById(gameId);
          if (game && game.status === 'active') {
            game.whiteTimeRemaining = whiteTime;
            game.blackTimeRemaining = blackTime;
            await game.save();
          }
        }
      } catch (error) {
        console.error('Error updating time:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });

  server.listen(port, () => {
    console.log(`🚀 Server ready on http://${hostname}:${port}`);
  });
});
