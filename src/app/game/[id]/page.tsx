'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useAuthCheck } from '@/hooks/useAuthCheck';
import { useAuthStore } from '@/store';
import { Button } from '@/app/components/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/Card';
import { Clock, Flag, Handshake, ArrowLeft, Trophy } from 'lucide-react';
import Link from 'next/link';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthCheck(); // Use the auth check hook
  const { setUser } = useAuthStore(); // Get setUser to update user data
  const gameId = params.id as string;

  const [game, setGame] = useState<any>(null);
  const [chess] = useState(new Chess());
  const [fen, setFen] = useState('start');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<'w' | 'b'>('w');
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<any>(null);
  const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] });
  const [drawOffered, setDrawOffered] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [draggedSquare, setDraggedSquare] = useState<string | null>(null);

  // Auto-hide notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Function to refetch user data (to get updated rating after game ends)
  const refetchUserData = useCallback(async () => {
    try {
      const response = await axios.get('/api/auth/me');
      if (response.data.success) {
        setUser(response.data.data.user);
        console.log('✅ User data refreshed. New rating:', response.data.data.user.rating);
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  }, [setUser]);

  // Initialize socket connection and fetch game data
  useEffect(() => {
    if (authLoading) return; // Wait for auth check
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchGame = async () => {
      try {
        const response = await axios.get(`/api/games/${gameId}`);
        if (response.data.success) {
          const gameData = response.data.data.game;
          console.log('Game data loaded:', gameData);
          setGame(gameData);
          setWhiteTime(gameData.whiteTimeRemaining || 0);
          setBlackTime(gameData.blackTimeRemaining || 0);
          
          // Load the FEN position from the database
          if (gameData.fen) {
            chess.load(gameData.fen);
            setFen(gameData.fen);
          }
          
          setCurrentTurn(chess.turn());
          setCapturedPieces(gameData.capturedPieces || { white: [], black: [] });
          setMoveHistory(gameData.moves || []);

          if (gameData.status === 'completed') {
            setGameOver(true);
            setGameResult({
              winner: gameData.winner,
              reason: gameData.endReason,
            });
          }
        }
      } catch (error) {
        console.error('Fetch game error:', error);
        router.push('/dashboard');
      }
    };

    fetchGame();

    // Initialize Socket.io
    const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      newSocket.emit('join-game', { gameId, userId: user._id });
    });

    newSocket.on('game-state', (data) => {
      console.log('Game state received from server:', data);
      
      // Sync timers from database immediately
      if (data.whiteTimeRemaining !== undefined) {
        setWhiteTime(data.whiteTimeRemaining);
      }
      if (data.blackTimeRemaining !== undefined) {
        setBlackTime(data.blackTimeRemaining);
      }
      
      // Always check and update game over state from the socket data
      // This ensures the state is correct even after a refresh
      if (data.status === 'completed' || data.gameOver) {
        console.log('Setting game over from socket. Status:', data.status, 'GameOver:', data.gameOver);
        setGameOver(true);
        if (data.endReason) {
          setGameResult({
            reason: data.endReason,
            winner: data.winner || null,
          });
        }
      }
      
      // Always update position from socket to ensure sync
      if (data.fen) {
        chess.load(data.fen);
        setFen(data.fen);
        setCurrentTurn(data.turn);
      }
      
      // Update game data if provided
      if (data.gameData) {
        setGame(data.gameData);
        
        // Restore move history and captured pieces
        if (data.gameData.moves && data.gameData.moves.length > 0) {
          setMoveHistory(data.gameData.moves);
          console.log('Restored move history from socket:', data.gameData.moves.length, 'moves');
        }
        if (data.gameData.capturedPieces) {
          setCapturedPieces(data.gameData.capturedPieces);
          console.log('Restored captured pieces from socket:', data.gameData.capturedPieces);
        }
      }
    });

    newSocket.on('move-made', (data) => {
      console.log('Move received:', data);
      console.log('Captured pieces:', data.capturedPieces);
      console.log('Moves:', data.moves);
      // Load the new position into the chess instance
      chess.load(data.fen);
      setFen(data.fen);
      setCurrentTurn(data.turn);
      if (data.move) {
        setLastMove({ from: data.move.from, to: data.move.to });
      }
      if (data.capturedPieces) {
        setCapturedPieces(data.capturedPieces);
      }
      if (data.moves) {
        setMoveHistory(data.moves);
      }
      
      // Check for game end conditions
      if (data.gameOver) {
        setGameOver(true);
        setGame((currentGame: any) => {
          if (!currentGame) return currentGame;
          
          if (data.isCheckmate) {
            const winner = data.turn === 'w' ? currentGame.blackPlayer : currentGame.whitePlayer;
            setGameResult({ reason: 'checkmate', winner });
            setNotification({ 
              message: winner._id === user?._id ? 'Checkmate! You win! 🎉' : 'Checkmate! You lost.', 
              type: winner._id === user?._id ? 'success' : 'error' 
            });
          } else if (data.isStalemate) {
            setGameResult({ reason: 'stalemate', winner: null });
            setNotification({ message: 'Game ended in stalemate', type: 'info' });
          } else if (data.isDraw) {
            setGameResult({ reason: 'draw', winner: null });
            setNotification({ message: 'Game ended in a draw', type: 'info' });
          }
          
          return currentGame;
        });
        // Refetch user data to get updated rating
        refetchUserData();
      }
    });

    newSocket.on('game-over', (data) => {
      setGameOver(true);
      setGameResult(data);
      // Refetch user data to get updated rating
      refetchUserData();
    });

    newSocket.on('draw-offered', () => {
      setDrawOffered(true);
      setNotification({ message: 'Opponent offers a draw', type: 'info' });
    });

    newSocket.on('player-resigned', ({ userId, currentGame }) => {
      console.log('Player resigned:', userId);
      setGameOver(true);
      setGame(currentGame);
      // Refetch user data to get updated rating
      refetchUserData();
    });

    newSocket.on('draw-accepted', () => {
      console.log('Draw accepted');
      setGameOver(true);
      setGameResult({ reason: 'draw', winner: null });
      setDrawOffered(false);
      setNotification({ message: 'Draw accepted. Game over!', type: 'info' });
      // Refetch user data to get updated rating
      refetchUserData();
    });

    newSocket.on('time-updated', (data) => {
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
    });

    newSocket.on('time-sync', (data) => {
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      const errorMessage = typeof error === 'string' ? error : error?.message || 'An error occurred';
      // Only show error notification if it's not a "game not found in memory" error
      // since we auto-recreate the game
      if (!errorMessage.includes('Game not found in memory')) {
        setNotification({ message: errorMessage, type: 'error' });
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [gameId, user, router, authLoading]);

  // Periodic sync: Request current game state every 10 seconds to ensure sync
  useEffect(() => {
    if (!socket || !gameId || gameOver) return;

    const syncInterval = setInterval(() => {
      // Request fresh game state to sync times
      socket.emit('request-sync', { gameId });
    }, 10000); // Every 10 seconds

    return () => clearInterval(syncInterval);
  }, [socket, gameId, gameOver]);

  // Timer logic
  useEffect(() => {
    if (!game || gameOver || game.status !== 'active') return;

    const interval = setInterval(() => {
      if (currentTurn === 'w') {
        setWhiteTime((prev) => {
          const newTime = Math.max(0, prev - 1);
          // Emit time update every 3 seconds to save to database and sync all clients
          if (socket && newTime % 3 === 0) {
            socket.emit('time-update', { gameId, whiteTime: newTime, blackTime });
          }
          return newTime;
        });
      } else {
        setBlackTime((prev) => {
          const newTime = Math.max(0, prev - 1);
          // Emit time update every 3 seconds to save to database and sync all clients
          if (socket && newTime % 3 === 0) {
            socket.emit('time-update', { gameId, whiteTime, blackTime: newTime });
          }
          return newTime;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [game, gameId, currentTurn, gameOver, socket, whiteTime, blackTime]);

  const onDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    if (gameOver || !game || game.status !== 'active') return false;

    // Check if it's the player's turn
    const isWhitePlayer = game.whitePlayer._id === user?._id;
    const isBlackPlayer = game.blackPlayer._id === user?._id;
    
    if ((currentTurn === 'w' && !isWhitePlayer) || (currentTurn === 'b' && !isBlackPlayer)) {
      return false;
    }

    // Clear selected square and possible moves
    setSelectedSquare(null);
    setPossibleMoves([]);
    setDraggedSquare(null);

    return makeMove(sourceSquare, targetSquare);
  }, [chess, currentTurn, game, gameId, gameOver, socket, user]);

  const onPieceDragBegin = (piece: string, sourceSquare: string) => {
    setDraggedSquare(sourceSquare);
  };

  const onPieceDragEnd = () => {
    setDraggedSquare(null);
  };

  const handleResign = async () => {
    if (socket && user && !gameOver) {
      console.log('Resigning game:', gameId);
      socket.emit('resign', { gameId, userId: user._id });
      
      // Update local state immediately
      setGameOver(true);
      const isWhitePlayer = game?.whitePlayer._id === user._id;
      setGameResult({
        reason: 'resignation',
        winner: isWhitePlayer ? game.blackPlayer : game.whitePlayer,
      });
    }
  };

  const handleOfferDraw = () => {
    if (socket && !gameOver) {
      socket.emit('offer-draw', { gameId, userId: user?._id });
      setNotification({ message: 'Draw offer sent to opponent', type: 'info' });
    }
  };

  const handleAcceptDraw = () => {
    if (socket && !gameOver) {
      console.log('Accepting draw offer');
      socket.emit('accept-draw', { gameId });
      
      // Update local state immediately
      setGameOver(true);
      setGameResult({ reason: 'draw', winner: null });
      setDrawOffered(false);
    }
  };

  const getSquareStyles = () => {
    const styles: Record<string, React.CSSProperties> = {};

    // Highlight last move
    if (lastMove) {
      styles[lastMove.from] = {
        backgroundColor: 'rgba(255, 255, 0, 0.4)',
      };
      styles[lastMove.to] = {
        backgroundColor: 'rgba(255, 255, 0, 0.4)',
      };
    }

    // Highlight selected square
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(130, 151, 105, 0.6)',
      };
    }

    // Highlight dragged square
    if (draggedSquare) {
      styles[draggedSquare] = {
        backgroundColor: 'rgba(130, 151, 105, 0.5)',
      };
    }

    // Show possible moves with dots
    possibleMoves.forEach((square) => {
      const hasPiece = chess.get(square as any);
      styles[square] = {
        background: hasPiece
          ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
          : 'radial-gradient(circle, rgba(0,0,0,.2) 25%, transparent 25%)',
        borderRadius: '50%',
      };
    });

    // Highlight king in check
    if (chess.inCheck()) {
      const kingSquare = findKingSquare(chess.turn());
      if (kingSquare) {
        styles[kingSquare] = {
          backgroundColor: chess.isCheckmate() ? 'rgba(255, 0, 0, 0.7)' : 'rgba(255, 0, 0, 0.5)',
          boxShadow: chess.isCheckmate() ? 'inset 0 0 20px rgba(139, 0, 0, 0.8)' : 'inset 0 0 15px rgba(139, 0, 0, 0.6)',
        };
      }
    }

    return styles;
  };

  const findKingSquare = (color: 'w' | 'b') => {
    const board = chess.board();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'k' && piece.color === color) {
          const file = String.fromCharCode(97 + col); // a-h
          const rank = (8 - row).toString(); // 1-8
          return file + rank;
        }
      }
    }
    return null;
  };

  const getMoves = (square: string) => {
    const moves = chess.moves({ square: square as any, verbose: true });
    return moves.map((move) => move.to);
  };

  const onSquareClick = (square: string) => {
    if (gameOver || !game || game.status !== 'active') return;

    // Check if it's the player's turn
    const isWhitePlayer = game.whitePlayer._id === user?._id;
    const isBlackPlayer = game.blackPlayer._id === user?._id;
    
    if ((currentTurn === 'w' && !isWhitePlayer) || (currentTurn === 'b' && !isBlackPlayer)) {
      return;
    }

    const piece = chess.get(square as any);

    // If a square is already selected
    if (selectedSquare) {
      // If clicking the same square, deselect
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setPossibleMoves([]);
        return;
      }

      // If clicking a possible move, make the move
      if (possibleMoves.includes(square)) {
        makeMove(selectedSquare, square);
        setSelectedSquare(null);
        setPossibleMoves([]);
        return;
      }

      // If clicking another piece of the same color, select it
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
        setPossibleMoves(getMoves(square));
        return;
      }

      // Otherwise, deselect
      setSelectedSquare(null);
      setPossibleMoves([]);
    } else {
      // No square selected, select this square if it has a piece of the current player
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
        setPossibleMoves(getMoves(square));
      }
    }
  };

  const makeMove = (from: string, to: string) => {
    try {
      const move = chess.move({
        from,
        to,
        promotion: 'q', // Always promote to queen for simplicity
      });

      if (move === null) return false;

      setFen(chess.fen());
      setCurrentTurn(chess.turn());
      setLastMove({ from, to });

      // Emit move to server
      if (socket) {
        socket.emit('make-move', {
          gameId,
          move: { from, to, promotion: 'q' },
          userId: user?._id,
        });
      }

      return true;
    } catch (error) {
      return false;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!game) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading game...</p>
      </div>
    );
  }

  const isWhitePlayer = game.whitePlayer._id === user?._id;
  const playerColor = isWhitePlayer ? 'white' : 'black';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`px-6 py-4 rounded-lg shadow-lg ${
            notification.type === 'success' ? 'bg-green-500 text-white' :
            notification.type === 'info' ? 'bg-blue-500 text-white' :
            notification.type === 'warning' ? 'bg-yellow-500 text-white' :
            'bg-red-500 text-white'
          }`}>
            {notification.message}
          </div>
        </div>
      )}

      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Opponent Info */}
          <div className="lg:col-span-2">
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-semibold">
                        {isWhitePlayer ? game.blackPlayer.username : game.whitePlayer.username}
                      </p>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        {isWhitePlayer ? game.blackPlayer.rating : game.whitePlayer.rating}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-lg font-bold">
                    <Clock className="h-5 w-5" />
                    {formatTime(isWhitePlayer ? blackTime : whiteTime)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Chess Board */}
            <div className="aspect-square max-w-2xl mx-auto">
              <Chessboard
                position={fen}
                onPieceDrop={onDrop}
                onSquareClick={onSquareClick}
                onPieceDragBegin={onPieceDragBegin}
                onPieceDragEnd={onPieceDragEnd}
                boardOrientation={playerColor}
                customBoardStyle={{
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                customSquareStyles={getSquareStyles()}
                areArrowsAllowed={false}
              />
            </div>

            {/* Player Info */}
            <Card className="mt-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-semibold">{user?.username} (You)</p>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        {user?.rating}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-lg font-bold">
                    <Clock className="h-5 w-5" />
                    {formatTime(isWhitePlayer ? whiteTime : blackTime)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Game Controls & Info */}
          <div className="space-y-4">
            {/* Game Status */}
            {console.log('Rendering game status. GameOver:', gameOver, 'GameResult:', gameResult)}
            {gameOver && gameResult && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-center">Game Over</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  {gameResult.winner ? (
                    <p className="text-lg font-semibold">
                      {gameResult.winner._id === user?._id ? '🎉 You won!' : 'You lost'}
                    </p>
                  ) : null}
                  <p className="text-sm text-gray-600 mt-2">
                    By {gameResult.reason}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Draw Offer */}
            {drawOffered && !gameOver && (
              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="p-4">
                  <p className="text-center font-semibold mb-3">
                    Opponent offers a draw
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleAcceptDraw} className="flex-1">
                      Accept
                    </Button>
                    <Button
                      onClick={() => setDrawOffered(false)}
                      variant="outline"
                      className="flex-1"
                    >
                      Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Game Controls */}
            {!gameOver && (
              <Card>
                <CardHeader>
                  <CardTitle>Game Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button onClick={handleOfferDraw} className="w-full" variant="outline">
                    <Handshake className="h-4 w-4 mr-2" />
                    Offer Draw
                  </Button>
                  <Button onClick={handleResign} className="w-full" variant="destructive">
                    <Flag className="h-4 w-4 mr-2" />
                    Resign
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Move History */}
            <Card>
              <CardHeader>
                <CardTitle>Move History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto">
                  {moveHistory.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No moves yet
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {moveHistory.map((move, index) => (
                        <div key={index} className="text-sm">
                          <span className="text-gray-500">{Math.floor(index / 2) + 1}.</span>{' '}
                          {move}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Captured Pieces */}
            <Card>
              <CardHeader>
                <CardTitle>Captured Pieces</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold mb-1">White captured:</p>
                    <div className="flex flex-wrap gap-1">
                      {capturedPieces.white.map((piece, idx) => (
                        <span key={idx} className="text-2xl">
                          {getPieceSymbol(piece, 'b')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1">Black captured:</p>
                    <div className="flex flex-wrap gap-1">
                      {capturedPieces.black.map((piece, idx) => (
                        <span key={idx} className="text-2xl">
                          {getPieceSymbol(piece, 'w')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function getPieceSymbol(piece: string, color: string) {
  const symbols: any = {
    p: color === 'w' ? '♙' : '♟',
    n: color === 'w' ? '♘' : '♞',
    b: color === 'w' ? '♗' : '♝',
    r: color === 'w' ? '♖' : '♜',
    q: color === 'w' ? '♕' : '♛',
    k: color === 'w' ? '♔' : '♚',
  };
  return symbols[piece] || piece;
}
