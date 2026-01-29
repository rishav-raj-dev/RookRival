'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
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

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }
    
    setLoading(false);
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
        // Start polling for match
        const pollInterval = setInterval(async () => {
          try {
            const pollResponse = await axios.post('/api/matchmaking', { timeControl });
            if (pollResponse.data.data.matched) {
              clearInterval(pollInterval);
              router.push(`/game/${pollResponse.data.data.gameId}`);
            }
          } catch (error) {
            console.error('Polling error:', error);
          }
        }, 3000);

        // Clear interval after 60 seconds
        setTimeout(() => {
          clearInterval(pollInterval);
        }, 60000);
      }
    } catch (error) {
      console.error('Matchmaking error:', error);
      setSearching(false);
    }
  };

  const handleCancelSearch = async () => {
    try {
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
            <h1 className="text-2xl font-bold">Chess App</h1>
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
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-6 w-6" />
                  Friends
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
