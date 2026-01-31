'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { useAuthCheck } from '@/hooks/useAuthCheck';
import { useAuthStore } from '@/store';
import { Button } from '@/app/components/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/Card';
import { Users, Clock, History, LogOut, Trophy } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthCheck();
  const { logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [showTimeControls, setShowTimeControls] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchTimer, setSearchTimer] = useState(60);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }
    
    setLoading(false);
    
    // Fetch notification count
    const fetchNotifications = async () => {
      try {
        const response = await axios.get('/api/friends/notifications');
        if (response.data.success) {
          setNotificationCount(response.data.data.total);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };
    
    fetchNotifications();
    
    // Initialize Socket.IO for real-time updates
    const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      // Join user-specific room for notifications
      newSocket.emit('join-user', user._id);
    });

    // Listen for friend request events
    newSocket.on('friend-request-received', () => {
      console.log('Friend request received event');
      fetchNotifications();
    });

    newSocket.on('friend-request-accepted', () => {
      console.log('Friend request accepted event');
      fetchNotifications();
    });

    newSocket.on('friend-request-rejected', () => {
      console.log('Friend request rejected event');
      fetchNotifications();
    });

    // Listen for challenge events
    newSocket.on('challenge-received', () => {
      console.log('Challenge received event');
      fetchNotifications();
    });

    newSocket.on('challenge-accepted', () => {
      console.log('Challenge accepted event');
      fetchNotifications();
    });

    newSocket.on('challenge-rejected', () => {
      console.log('Challenge rejected event');
      fetchNotifications();
    });
    
    return () => {
      newSocket.disconnect();
    }
    return () => clearInterval(notificationInterval);
  }, [user, router, authLoading]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (searching && searchTimer > 0) {
      interval = setInterval(() => {
        setSearchTimer((prev) => prev - 1);
      }, 1000);
    } else if (searchTimer === 0) {
      handleCancelSearch();
    }
    return () => clearInterval(interval);
  }, [searching, searchTimer]);

  const handleLogout = async () => {
    await axios.post('/api/auth/logout');
    logout();
    router.push('/login');
  };

  const handleQuickMatch = async (timeControl: any) => {
    setSearching(true);
    setSearchTimer(60);

    try {
      const response = await axios.post('/api/matchmaking', { timeControl });
      
      if (response.data.data.matched) {
        router.push(`/game/${response.data.data.gameId}`);
      } else {
        // Start polling for match using GET endpoint
        const interval = setInterval(async () => {
          try {
            const pollResponse = await axios.get('/api/matchmaking');
            if (pollResponse.data.data.matched) {
              clearInterval(interval);
              setPollInterval(null);
              router.push(`/game/${pollResponse.data.data.gameId}`);
            }
          } catch (error) {
            console.error('Polling error:', error);
          }
        }, 2000); // Poll every 2 seconds
        
        setPollInterval(interval);

        // Clear interval after 60 seconds
        setTimeout(() => {
          clearInterval(interval);
          setPollInterval(null);
          setSearching(false);
        }, 60000);
      }
    } catch (error) {
      console.error('Matchmaking error:', error);
      setSearching(false);
    }
  };

  const handleCancelSearch = async () => {
    try {
      // Clear polling interval if exists
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }
      
      await axios.delete('/api/matchmaking');
      setSearching(false);
      setSearchTimer(60);
      setShowTimeControls(false);
    } catch (error) {
      console.error('Cancel search error:', error);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (searching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900 mx-auto"></div>
              <h2 className="text-2xl font-bold">Searching for opponent...</h2>
              <p className="text-gray-600">
                Time remaining: {searchTimer}s
              </p>
              <Button onClick={handleCancelSearch} variant="outline">
                Cancel Search
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold">RookRival</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="font-semibold">{user?.rating || 1200}</span>
              </div>
              <span className="text-gray-700">{user?.username}</span>
              <Button onClick={handleLogout} variant="ghost" size="sm">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-6 w-6" />
                Play Random Opponent
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!showTimeControls ? (
                <Button 
                  onClick={() => setShowTimeControls(true)}
                  className="w-full"
                >
                  Quick Match
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button 
                    onClick={() => handleQuickMatch({ type: '10min' })}
                    className="w-full"
                    variant="outline"
                  >
                    10 Minutes
                  </Button>
                  <Button 
                    onClick={() => handleQuickMatch({ type: '30min' })}
                    className="w-full"
                    variant="outline"
                  >
                    30 Minutes
                  </Button>
                  <Button 
                    onClick={() => handleQuickMatch({ type: '60min' })}
                    className="w-full"
                    variant="outline"
                  >
                    60 Minutes
                  </Button>
                  <Button 
                    onClick={() => handleQuickMatch({ type: 'unlimited' })}
                    className="w-full"
                    variant="outline"
                  >
                    Unlimited
                  </Button>
                  <Button 
                    onClick={() => setShowTimeControls(false)}
                    className="w-full"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Link href="/friends">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-6 w-6" />
                    Friends
                  </div>
                  {notificationCount > 0 && (
                    <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 text-xs font-bold text-white bg-red-500 rounded-full">
                      {notificationCount}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Find friends, send challenges, and view friend requests
                </p>
                <Button className="w-full">Manage Friends</Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/history">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-6 w-6" />
                  Match History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  View and replay your past games
                </p>
                <Button className="w-full">View History</Button>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
