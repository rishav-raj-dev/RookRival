'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store';
import { useAuthCheck } from '@/hooks/useAuthCheck';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/Card';
import { Search, UserPlus, Check, X, Swords, ArrowLeft, Trophy, Clock } from 'lucide-react';
import Link from 'next/link';

export default function FriendsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthCheck(); // Use the auth check hook
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [receivedChallenges, setReceivedChallenges] = useState<any[]>([]);
  const [sentChallenges, setSentChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTimeControl, setShowTimeControl] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // Auto-hide notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (authLoading) return; // Wait for auth check
    if (!user) {
      router.push('/login');
      return;
    }
    fetchFriends();
    fetchChallenges();

    // Initialize socket for real-time notifications
    const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected, joining user room:', user._id);
      newSocket.emit('join-user', user._id);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    // Friend request events
    newSocket.on('friend-request-received', (targetUserId) => {
      console.log('New friend request received!');
      setNotification({ message: 'New friend request received!', type: 'info' });
      fetchFriends();
    });

    newSocket.on('friend-request-accepted', (message) => {
      console.log('Your friend request was accepted!');
      setNotification({ message: message.message || 'Friend request accepted!', type: 'success' });
      fetchFriends();
    });

    newSocket.on('friend-request-rejected', (message) => {
      console.log('Your friend request was rejected');
      console.log('Message:', message);
      setNotification({ message: message['message'] || 'Friend request was declined', type: 'warning' });
      fetchFriends();
    });

    // Challenge events
    newSocket.on('challenge-received', (message) => {
      console.log('New challenge received!');
      console.log('Message:', message);
      setNotification({ message: message.message || 'New challenge received!', type: 'info' });
      fetchChallenges();
    });

    newSocket.on('challenge-accepted', ({ gameId }) => {
      console.log('Challenge accepted! Game ID:', gameId);
      setNotification({ message: 'Challenge accepted! Starting game...', type: 'success' });
      setTimeout(() => router.push(`/game/${gameId}`), 1000);
    });

    newSocket.on('challenge-rejected', (message) => {
      console.log('✅ Challenge rejected event received - refreshing challenges list');
      setNotification({ message: message.message || 'Challenge was declined', type: 'warning' });
      fetchChallenges();
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user, router, authLoading]);

  const fetchFriends = async () => {
    try {
      const response = await axios.get('/api/friends');
      if (response.data.success) {
        setFriends(response.data.data.friends);
        setPendingRequests(response.data.data.pendingRequests);
      }
    } catch (error) {
      console.error('Fetch friends error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChallenges = async () => {
    try {
      const response = await axios.get('/api/friends/challenges');
      if (response.data.success) {
        setReceivedChallenges(response.data.data.receivedChallenges);
        setSentChallenges(response.data.data.sentChallenges);
      }
    } catch (error) {
      console.error('Fetch challenges error:', error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;

    try {
      const response = await axios.get(`/api/users/search?q=${searchQuery}`);
      if (response.data.success) {
        setSearchResults(response.data.data.users);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    try {
      const response = await axios.post('/api/friends/send-request', { targetUserId });
      if (response.data.success) {
        setNotification({ message: 'Friend request sent!', type: 'success' });
        setSearchResults(searchResults.filter(u => u._id !== targetUserId));
        
        // Notify the target user via socket
        if (socket) {
          socket.emit('send-friend-request', { targetUserId });
        }
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to send request');
    }
  };

  const handleRespondToRequest = async (requesterId: string, action: 'accept' | 'reject') => {
    try {
      const response = await axios.post('/api/friends/respond', { requesterId, action });
      if (response.data.success) {
        fetchFriends();
        // Notify the requester via socket
        if (socket) {
          socket.emit('friend-request-response', { targetUserId: requesterId, action, message: response.data.message });
        }
      }
    } catch (error) {
      console.error('Respond to request error:', error);
    }
  };

  const handleChallengeFriend = async (friendId: string, timeControl: any) => {
    try {
      const response = await axios.post('/api/friends/challenge', {
        friendId,
        timeControl,
      });
      
      if (response.data.success) {
        setShowTimeControl(null);
        setNotification({ message: 'Challenge sent! Waiting for response...', type: 'success' });
        
        // Notify opponent via socket
        if (socket) {
          console.log('Sending challenge notification to:', friendId);
          socket.emit('send-challenge', {
            challengeId: response.data.data.challenge._id,
            challengedUserId: friendId,
            message: response.data.message
          });
        }
        
        fetchChallenges();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to send challenge');
    }
  };

  const handleRespondToChallenge = async (challengeId: string, action: 'accept' | 'reject') => {
    try {
      const response = await axios.post('/api/friends/respond-challenge', {
        challengeId,
        action,
      });
      
      if (response.data.success) {
        // Notify challenger via socket (for both accept and reject)
        if (socket && response.data.data?.challengerId) {
          console.log('Sending challenge response to:', response.data.data.challengerId, 'action:', action, 'gameId:', response.data.data?.gameId);
          socket.emit('challenge-response', {
            challengerId: response.data.data.challengerId,
            action,
            gameId: response.data.data?.gameId,
            message: response.data.data?.message
          });
        }
        
        if (action === 'accept' && response.data.data?.gameId) {
          setNotification({ message: 'Challenge accepted! Starting game...', type: 'success' });
          setTimeout(() => router.push(`/game/${response.data.data.gameId}`), 1000);
        } else if (action === 'reject') {
          setNotification({ message: 'Challenge declined', type: 'info' });
          fetchChallenges();
        }
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to respond to challenge');
    }
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
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`px-6 py-4 rounded-lg shadow-lg ${
            notification.type === 'success' ? 'bg-green-500 text-white' :
            notification.type === 'info' ? 'bg-blue-500 text-white' :
            'bg-yellow-500 text-white'
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
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Friends</h1>

        {/* Search Users */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-6 w-6" />
              Find Friends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type="text"
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">Search</Button>
            </form>

            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((user) => (
                  <div
                    key={user._id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold">{user.username}</p>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Trophy className="h-3 w-3" /> {user.rating}
                        </p>
                      </div>
                    </div>
                    <>
                      {
                        friends.some(f => f._id === user._id) ? 'Friends' : 
                        pendingRequests.some(r => r.from._id === user._id) ? 'Requested' : 
                        <Button
                          size="sm"
                          onClick={() => handleSendRequest(user._id)}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add Friend
                        </Button>
                      }
                    </>
                      
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Received Challenges */}
        {receivedChallenges.length > 0 && (
          <Card className="mb-8 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Swords className="h-5 w-5" />
                Incoming Challenges ({receivedChallenges.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {receivedChallenges.map((challenge: any) => (
                  <div
                    key={challenge._id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200"
                  >
                    <div>
                      <p className="font-semibold">{challenge.challenger.username}</p>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Trophy className="h-3 w-3" /> {challenge.challenger.rating}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {challenge.timeControl.type === '10min' && '10 minutes'}
                        {challenge.timeControl.type === '30min' && '30 minutes'}
                        {challenge.timeControl.type === '60min' && '60 minutes'}
                        {challenge.timeControl.type === 'custom' && `${challenge.timeControl.minutes} minutes`}
                        {challenge.timeControl.type === 'unlimited' && 'Unlimited'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleRespondToChallenge(challenge._id, 'accept')}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRespondToChallenge(challenge._id, 'reject')}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sent Challenges */}
        {sentChallenges.length > 0 && (
          <Card className="mb-8 border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle>Sent Challenges ({sentChallenges.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sentChallenges.map((challenge: any) => (
                  <div
                    key={challenge._id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-yellow-200"
                  >
                    <div>
                      <p className="font-semibold">{challenge.challenged.username}</p>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Trophy className="h-3 w-3" /> {challenge.challenged.rating}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {challenge.timeControl.type === '10min' && '10 minutes'}
                        {challenge.timeControl.type === '30min' && '30 minutes'}
                        {challenge.timeControl.type === '60min' && '60 minutes'}
                      </p>
                    </div>
                    <p className="text-sm text-gray-500">Waiting for response...</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Friend Requests ({pendingRequests.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingRequests.map((request: any) => (
                  <div
                    key={request.from._id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">{request.from.username}</p>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Trophy className="h-3 w-3" /> {request.from.rating}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleRespondToRequest(request.from._id, 'accept')}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRespondToRequest(request.from._id, 'reject')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Friends List */}
        <Card>
          <CardHeader>
            <CardTitle>My Friends ({friends.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {friends.length === 0 ? (
              <p className="text-gray-600 text-center py-8">
                No friends yet. Search for users above to add friends!
              </p>
            ) : (
              <div className="space-y-2">
                {friends.map((friend: any) => (
                  <div
                    key={friend._id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">{friend.username}</p>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Trophy className="h-3 w-3" /> {friend.rating}
                      </p>
                    </div>
                    <div>
                      {showTimeControl === friend._id ? (
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleChallengeFriend(friend._id, { type: '10min' })}
                          >
                            10 min
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleChallengeFriend(friend._id, { type: '30min' })}
                          >
                            30 min
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowTimeControl(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setShowTimeControl(friend._id)}
                        >
                          <Swords className="h-4 w-4 mr-2" />
                          Challenge
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
