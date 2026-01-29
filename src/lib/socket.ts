import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Chess } from 'chess.js';
import connectDB from '@/lib/db';
import Game from '@/models/Game';
import User from '@/models/User';
import { calculateEloRating } from '@/utils/elo';

const games = new Map<string, Chess>(); // Store active games in memory
const timers = new Map<string, NodeJS.Timeout>(); // Store game timers

export function initializeSocket(server: HTTPServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join a game room
    socket.on('join-game', async (gameId: string) => {
      try {
        await connectDB();
        const game = await Game.findById(gameId)
          .populate('whitePlayer', 'username rating')
          .populate('blackPlayer', 'username rating');

        if (!game) {
          socket.emit('error', 'Game not found');
          return;
        }

        socket.join(gameId);

        // Initialize chess instance if not exists
        if (!games.has(gameId)) {
          const chess = new Chess(game.fen);
          games.set(gameId, chess);
        }

        socket.emit('game-state', {
          game,
          fen: game.fen,
          turn: games.get(gameId)?.turn(),
        });

        console.log(`User joined game: ${gameId}`);
      } catch (error) {
        console.error('Join game error:', error);
        socket.emit('error', 'Failed to join game');
      }
    });

    // Make a move
    socket.on('make-move', async ({ gameId, move }) => {
      try {
        await connectDB();
        const game = await Game.findById(gameId);

        if (!game || game.status !== 'active') {
          socket.emit('error', 'Game is not active');
          return;
        }

        const chess = games.get(gameId);
        if (!chess) {
          socket.emit('error', 'Chess instance not found');
          return;
        }

        // Attempt to make the move
        const result = chess.move(move);
        if (!result) {
          socket.emit('error', 'Invalid move');
          return;
        }

        // Update captured pieces
        if (result.captured) {
          const color = result.color === 'w' ? 'white' : 'black';
          game.capturedPieces[color].push(result.captured);
        }

        // Update game in database
        game.moves.push(result.san);
        game.fen = chess.fen();
        game.pgn = chess.pgn();

        // Check game end conditions
        if (chess.isCheckmate()) {
          const winner = chess.turn() === 'w' ? game.blackPlayer : game.whitePlayer;
          await endGame(game, winner, 'checkmate');
          io.to(gameId).emit('game-over', {
            winner,
            reason: 'checkmate',
            fen: chess.fen(),
          });
        } else if (chess.isStalemate()) {
          await endGame(game, null, 'stalemate');
          io.to(gameId).emit('game-over', {
            winner: null,
            reason: 'stalemate',
            fen: chess.fen(),
          });
        } else if (chess.isDraw()) {
          await endGame(game, null, 'draw');
          io.to(gameId).emit('game-over', {
            winner: null,
            reason: 'draw',
            fen: chess.fen(),
          });
        }

        await game.save();

        // Broadcast move to all players in the game
        io.to(gameId).emit('move-made', {
          move: result,
          fen: chess.fen(),
          turn: chess.turn(),
          moves: game.moves,
          capturedPieces: game.capturedPieces,
        });
      } catch (error) {
        console.error('Make move error:', error);
        socket.emit('error', 'Failed to make move');
      }
    });

    // Resign
    socket.on('resign', async ({ gameId, userId }) => {
      try {
        await connectDB();
        const game = await Game.findById(gameId);

        if (!game || game.status !== 'active') {
          socket.emit('error', 'Game is not active');
          return;
        }

        const winner = game.whitePlayer.toString() === userId 
          ? game.blackPlayer 
          : game.whitePlayer;

        await endGame(game, winner, 'resignation');

        io.to(gameId).emit('game-over', {
          winner,
          reason: 'resignation',
          fen: game.fen,
        });
      } catch (error) {
        console.error('Resign error:', error);
        socket.emit('error', 'Failed to resign');
      }
    });

    // Offer draw
    socket.on('offer-draw', ({ gameId, userId }) => {
      socket.to(gameId).emit('draw-offered', { userId });
    });

    // Accept draw
    socket.on('accept-draw', async ({ gameId }) => {
      try {
        await connectDB();
        const game = await Game.findById(gameId);

        if (!game || game.status !== 'active') {
          socket.emit('error', 'Game is not active');
          return;
        }

        await endGame(game, null, 'draw');

        io.to(gameId).emit('game-over', {
          winner: null,
          reason: 'draw',
          fen: game.fen,
        });
      } catch (error) {
        console.error('Accept draw error:', error);
        socket.emit('error', 'Failed to accept draw');
      }
    });

    // Time update
    socket.on('time-update', async ({ gameId, whiteTime, blackTime }) => {
      try {
        await connectDB();
        const game = await Game.findById(gameId);

        if (!game) {
          return;
        }

        game.whiteTimeRemaining = whiteTime;
        game.blackTimeRemaining = blackTime;

        // Check for timeout
        if (whiteTime <= 0) {
          await endGame(game, game.blackPlayer, 'timeout');
          io.to(gameId).emit('game-over', {
            winner: game.blackPlayer,
            reason: 'timeout',
            fen: game.fen,
          });
        } else if (blackTime <= 0) {
          await endGame(game, game.whitePlayer, 'timeout');
          io.to(gameId).emit('game-over', {
            winner: game.whitePlayer,
            reason: 'timeout',
            fen: game.fen,
          });
        } else {
          await game.save();
          socket.to(gameId).emit('time-updated', { whiteTime, blackTime });
        }
      } catch (error) {
        console.error('Time update error:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

async function endGame(
  game: any,
  winner: any,
  reason: 'checkmate' | 'resignation' | 'timeout' | 'draw' | 'stalemate'
) {
  game.status = 'completed';
  game.endedAt = new Date();
  game.endReason = reason;

  if (winner) {
    game.winner = winner;
    game.result = game.whitePlayer.toString() === winner.toString() ? 'white' : 'black';

    // Update ratings
    const whiteUser = await User.findById(game.whitePlayer);
    const blackUser = await User.findById(game.blackPlayer);

    if (whiteUser && blackUser) {
      const isWhiteWinner = game.whitePlayer.toString() === winner.toString();
      const { newWinnerRating, newLoserRating } = calculateEloRating(
        isWhiteWinner ? whiteUser.rating : blackUser.rating,
        isWhiteWinner ? blackUser.rating : whiteUser.rating,
        false
      );

      if (isWhiteWinner) {
        whiteUser.rating = newWinnerRating;
        blackUser.rating = newLoserRating;
      } else {
        blackUser.rating = newWinnerRating;
        whiteUser.rating = newLoserRating;
      }

      await whiteUser.save();
      await blackUser.save();
    }
  } else {
    game.result = 'draw';

    // Update ratings for draw
    const whiteUser = await User.findById(game.whitePlayer);
    const blackUser = await User.findById(game.blackPlayer);

    if (whiteUser && blackUser) {
      const { newWinnerRating, newLoserRating } = calculateEloRating(
        whiteUser.rating,
        blackUser.rating,
        true
      );

      whiteUser.rating = newWinnerRating;
      blackUser.rating = newLoserRating;

      await whiteUser.save();
      await blackUser.save();
    }
  }

  await game.save();
}

export default initializeSocket;
