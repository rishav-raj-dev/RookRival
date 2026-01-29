export interface User {
  _id: string;
  username: string;
  rating: number;
  friends: string[];
  friendRequests: FriendRequest[];
  sentFriendRequests: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FriendRequest {
  from: string | User;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Game {
  _id: string;
  whitePlayer: string | User;
  blackPlayer: string | User;
  winner: string | null;
  result: 'white' | 'black' | 'draw' | 'ongoing' | 'abandoned';
  timeControl: TimeControl;
  moves: string[];
  pgn: string;
  fen: string;
  whiteTimeRemaining: number;
  blackTimeRemaining: number;
  status: 'waiting' | 'active' | 'completed';
  endReason?: 'checkmate' | 'resignation' | 'timeout' | 'draw' | 'stalemate' | 'abandoned';
  capturedPieces: {
    white: string[];
    black: string[];
  };
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeControl {
  type: '10min' | '30min' | '60min' | 'custom' | 'unlimited';
  minutes?: number;
}

export interface Challenge {
  _id: string;
  challenger: string | User;
  challenged: string | User;
  timeControl: TimeControl;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  gameId?: string;
  createdAt: string;
  expiresAt: string;
}

export interface GameMove {
  from: string;
  to: string;
  promotion?: string;
  piece?: string;
  captured?: string;
  san?: string;
}

export interface MatchmakingRequest {
  userId: string;
  username: string;
  rating: number;
  timeControl: TimeControl;
  timestamp: number;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
