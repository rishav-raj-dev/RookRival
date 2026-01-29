import mongoose, { Schema, Document } from 'mongoose';

export interface IGame extends Document {
  whitePlayer: mongoose.Types.ObjectId;
  blackPlayer: mongoose.Types.ObjectId;
  winner: mongoose.Types.ObjectId | null;
  result: 'white' | 'black' | 'draw' | 'ongoing' | 'abandoned';
  timeControl: {
    type: '10min' | '30min' | '60min' | 'custom' | 'unlimited';
    minutes?: number;
  };
  moves: string[]; // Array of moves in algebraic notation
  pgn: string; // Complete game in PGN format
  fen: string; // Current board position
  whiteTimeRemaining: number; // In seconds
  blackTimeRemaining: number; // In seconds
  status: 'waiting' | 'active' | 'completed';
  endReason?: 'checkmate' | 'resignation' | 'timeout' | 'draw' | 'stalemate' | 'abandoned';
  capturedPieces: {
    white: string[];
    black: string[];
  };
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GameSchema: Schema = new Schema({
  whitePlayer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  blackPlayer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  winner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  result: {
    type: String,
    enum: ['white', 'black', 'draw', 'ongoing', 'abandoned'],
    default: 'ongoing',
  },
  timeControl: {
    type: {
      type: String,
      enum: ['10min', '30min', '60min', 'custom', 'unlimited'],
      required: true,
    },
    minutes: {
      type: Number,
    },
  },
  moves: {
    type: [String],
    default: [],
  },
  pgn: {
    type: String,
    default: '',
  },
  fen: {
    type: String,
    default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Starting position
  },
  whiteTimeRemaining: {
    type: Number,
    required: true,
  },
  blackTimeRemaining: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed'],
    default: 'waiting',
  },
  endReason: {
    type: String,
    enum: ['checkmate', 'resignation', 'timeout', 'draw', 'stalemate', 'abandoned'],
  },
  capturedPieces: {
    white: {
      type: [String],
      default: [],
    },
    black: {
      type: [String],
      default: [],
    },
  },
  startedAt: {
    type: Date,
  },
  endedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
GameSchema.index({ whitePlayer: 1, createdAt: -1 });
GameSchema.index({ blackPlayer: 1, createdAt: -1 });
GameSchema.index({ status: 1 });

export default mongoose.models.Game || mongoose.model<IGame>('Game', GameSchema);
