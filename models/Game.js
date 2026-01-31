const mongoose = require('mongoose');
const { Schema } = mongoose;

const GameSchema = new Schema({
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
    default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  },
  whiteTimeRemaining: {
    type: Number,
    default: 600,
  },
  blackTimeRemaining: {
    type: Number,
    default: 600,
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

module.exports = mongoose.models.Game || mongoose.model('Game', GameSchema);
