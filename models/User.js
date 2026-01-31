const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  rating: {
    type: Number,
    default: 1200, // Starting ELO rating
  },
  friends: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
  friendRequests: [{
    from: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  sentFriendRequests: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

// Create indexes for better query performance
// Note: username already has unique index from schema definition
UserSchema.index({ rating: 1 });

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
