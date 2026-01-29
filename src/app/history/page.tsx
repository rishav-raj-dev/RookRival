'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useAuthCheck } from '@/hooks/useAuthCheck';
import { Button } from '@/app/components/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/Card';
import { Trophy, Calendar, Clock, ArrowLeft, Play, SkipBack, SkipForward } from 'lucide-react';
import Link from 'next/link';

export default function HistoryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthCheck();
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [replayPosition, setReplayPosition] = useState(0);
  const [chess, setChess] = useState(new Chess());

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }

    fetchHistory();
  }, [user, router, authLoading]);

  const fetchHistory = async () => {
    try {
      const response = await axios.get('/api/games/history');
      if (response.data.success) {
        setGames(response.data.data.games);
      }
    } catch (error) {
      console.error('Fetch history error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewGame = (game: any) => {
    setSelectedGame(game);
    setReplayPosition(0);
    
    // Reset chess to starting position
    const newChess = new Chess();
    setChess(newChess);
  };

  const handleNextMove = () => {
    if (!selectedGame || replayPosition >= selectedGame.moves.length) return;

    const newChess = new Chess();
    
    // Replay all moves up to the next position
    for (let i = 0; i <= replayPosition; i++) {
      // Convert algebraic notation to move object
      try {
        newChess.move(selectedGame.moves[i]);
      } catch (error) {
        console.error('Invalid move:', selectedGame.moves[i]);
      }
    }
    
    setChess(newChess);
    setReplayPosition(replayPosition + 1);
  };

  const handlePreviousMove = () => {
    if (!selectedGame || replayPosition <= 0) return;

    const newChess = new Chess();
    const newPosition = replayPosition - 2;
    
    // Replay all moves up to the previous position
    for (let i = 0; i < newPosition; i++) {
      try {
        newChess.move(selectedGame.moves[i]);
      } catch (error) {
        console.error('Invalid move:', selectedGame.moves[i]);
      }
    }
    
    setChess(newChess);
    setReplayPosition(newPosition + 1);
  };

  const handleResetReplay = () => {
    setReplayPosition(0);
    setChess(new Chess());
  };

  const getGameResult = (game: any) => {
    if (game.status === 'active') return 'Ongoing';
    if (game.result === 'draw' || game.endReason === 'draw' || game.endReason === 'stalemate') return 'Draw';
    if (game.winner?._id === user?._id) return 'Won';
    return 'Lost';
  };

  const getResultColor = (result: string) => {
    if (result === 'Won') return 'text-green-600 bg-green-50';
    if (result === 'Lost') return 'text-red-600 bg-red-50';
    if (result === 'Ongoing') return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Match History</h1>

        {selectedGame ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Replay Board */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Game Replay</CardTitle>
                    <Button
                      onClick={() => setSelectedGame(null)}
                      variant="outline"
                      size="sm"
                    >
                      Back to List
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="aspect-square max-w-2xl mx-auto mb-4">
                    <Chessboard position={chess.fen()} />
                  </div>
                  
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <Button
                      onClick={handleResetReplay}
                      variant="outline"
                      size="sm"
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={handlePreviousMove}
                      variant="outline"
                      size="sm"
                      disabled={replayPosition === 0}
                    >
                      Previous
                    </Button>
                    <span className="text-sm font-semibold">
                      Move {replayPosition} / {selectedGame.moves.length}
                    </span>
                    <Button
                      onClick={handleNextMove}
                      variant="outline"
                      size="sm"
                      disabled={replayPosition >= selectedGame.moves.length}
                    >
                      Next
                    </Button>
                    <Button
                      onClick={() => {
                        const newChess = new Chess();
                        selectedGame.moves.forEach((move: string) => {
                          try {
                            newChess.move(move);
                          } catch (error) {
                            console.error('Invalid move:', move);
                          }
                        });
                        setChess(newChess);
                        setReplayPosition(selectedGame.moves.length);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Current Move */}
                  {replayPosition > 0 && replayPosition <= selectedGame.moves.length && (
                    <div className="text-center">
                      <p className="text-sm text-gray-600">
                        Current move: <span className="font-semibold">{selectedGame.moves[replayPosition - 1]}</span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Game Details */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Game Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">White Player</p>
                    <p className="font-semibold flex items-center gap-2">
                      {selectedGame.whitePlayer.username}
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        {selectedGame.whitePlayer.rating}
                      </span>
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Black Player</p>
                    <p className="font-semibold flex items-center gap-2">
                      {selectedGame.blackPlayer.username}
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        {selectedGame.blackPlayer.rating}
                      </span>
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Result</p>
                    <p className={`font-semibold ${getResultColor(getGameResult(selectedGame))
                      .split(' ')[0]} inline-block px-2 py-1 rounded`}>
                      {getGameResult(selectedGame)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">End Reason</p>
                    <p className="font-semibold capitalize">{selectedGame.endReason}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Time Control</p>
                    <p className="font-semibold capitalize">{selectedGame.timeControl.type}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Date</p>
                    <p className="font-semibold">{formatDate(selectedGame.endedAt)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Move List */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>All Moves</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2">
                      {selectedGame.moves.map((move: string, index: number) => (
                        <div
                          key={index}
                          className={`text-sm p-1 rounded ${
                            index === replayPosition - 1 ? 'bg-blue-100 font-semibold' : ''
                          }`}
                        >
                          <span className="text-gray-500">{Math.floor(index / 2) + 1}.</span>{' '}
                          {move}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div>
            {games.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-gray-600 text-lg">No games played yet</p>
                  <p className="text-gray-500 mt-2">
                    Start playing to see your match history here
                  </p>
                  <Link href="/dashboard">
                    <Button className="mt-4">
                      Go to Dashboard
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {games.map((game) => {
                  const opponent = game.whitePlayer._id === user?._id
                    ? game.blackPlayer
                    : game.whitePlayer;
                  const result = getGameResult(game);

                  return (
                    <Card key={game._id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-4">
                              <div
                                className={`px-3 py-1 rounded font-semibold ${getResultColor(
                                  result
                                )}`}
                              >
                                {result}
                              </div>
                              <div>
                                <p className="font-semibold">vs {opponent.username}</p>
                                <p className="text-sm text-gray-600 flex items-center gap-1">
                                  <Trophy className="h-3 w-3" />
                                  {opponent.rating}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {formatDate(game.status === 'active' ? game.updatedAt : game.endedAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {game.timeControl.type}
                              </span>
                              {game.status === 'completed' && game.endReason && (
                                <span className="capitalize">
                                  {game.endReason}
                                </span>
                              )}
                            </div>
                          </div>
                          {game.status === 'active' ? (
                            <Link href={`/game/${game._id}`}>
                              <Button variant="default">
                                <Play className="h-4 w-4 mr-2" />
                                Rejoin Game
                              </Button>
                            </Link>
                          ) : (
                            <Button
                              onClick={() => handleViewGame(game)}
                              variant="outline"
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Replay
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
