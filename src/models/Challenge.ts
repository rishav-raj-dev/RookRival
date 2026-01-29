import mongoose, { Schema, Document } from 'mongoose';

export interface IChallenge extends Document {
  challenger: mongoose.Types.ObjectId;
  challenged: mongoose.Types.ObjectId;
  timeControl: {
    type: string;
    minutes?: number;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  gameId?: mongoose.Types.ObjectId;
  createdAt: Date;
  expiresAt: Date;
}

const ChallengeSchema = new Schema<IChallenge>(
  {
    challenger: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    challenged: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    timeControl: {
      type: {
        type: String,
        enum: ['10min', '30min', '60min', 'custom', 'unlimited'],
        required: true,
      },
      minutes: Number,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'expired'],
      default: 'pending',
    },
    gameId: {
      type: Schema.Types.ObjectId,
      ref: 'Game',
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
    },
  },
  { timestamps: true }
);

// Index for efficient queries
ChallengeSchema.index({ challenged: 1, status: 1 });
ChallengeSchema.index({ challenger: 1, status: 1 });
ChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired challenges

const Challenge = mongoose.models.Challenge || mongoose.model<IChallenge>('Challenge', ChallengeSchema);

export default Challenge;
