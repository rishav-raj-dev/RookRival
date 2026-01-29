import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import Game from '@/models/Game';
import { getUserFromRequest } from '@/lib/auth';
import { getRatingRange } from '@/utils/elo';

// In-memory matchmaking queue (in production, use Redis)
const matchmakingQueue: Map<string, any> = new Map();

export async function POST(request: NextRequest) {
  try {
    const authUser = getUserFromRequest(request);

    if (!authUser) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { timeControl } = await request.json();

    if (!timeControl) {
      return NextResponse.json(
        { success: false, message: 'Time control is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is already in queue
    if (matchmakingQueue.has(authUser.userId)) {
      return NextResponse.json(
        { success: false, message: 'Already in matchmaking queue' },
        { status: 400 }
      );
    }

    // Get rating range for matchmaking
    const ratingRange = getRatingRange(user.rating, 200);

    // Try to find a match
    let matchFound = false;
    let opponentId = null;

    for (const [userId, queueData] of matchmakingQueue.entries()) {
      // Check if time control matches
      if (queueData.timeControl.type !== timeControl.type) {
        continue;
      }

      // Check if custom time matches
      if (timeControl.type === 'custom' && 
          queueData.timeControl.minutes !== timeControl.minutes) {
        continue;
      }

      // Check rating range
      if (queueData.rating >= ratingRange.min && queueData.rating <= ratingRange.max) {
        matchFound = true;
        opponentId = userId;
        break;
      }
    }

    if (matchFound && opponentId) {
      // Remove opponent from queue
      matchmakingQueue.delete(opponentId);

      // Calculate time in seconds
      let timeInSeconds = 0;
      if (timeControl.type === '10min') {
        timeInSeconds = 10 * 60;
      } else if (timeControl.type === '30min') {
        timeInSeconds = 30 * 60;
      } else if (timeControl.type === '60min') {
        timeInSeconds = 60 * 60;
      } else if (timeControl.type === 'custom' && timeControl.minutes) {
        timeInSeconds = timeControl.minutes * 60;
      } else if (timeControl.type === 'unlimited') {
        timeInSeconds = 999999;
      }

      // Randomly assign colors
      const isWhite = Math.random() < 0.5;

      // Create game
      const game = await Game.create({
        whitePlayer: isWhite ? authUser.userId : opponentId,
        blackPlayer: isWhite ? opponentId : authUser.userId,
        timeControl,
        whiteTimeRemaining: timeInSeconds,
        blackTimeRemaining: timeInSeconds,
        status: 'active',
        startedAt: new Date(),
        moves: [],
        capturedPieces: { white: [], black: [] },
      });

      return NextResponse.json({
        success: true,
        data: { 
          matched: true, 
          gameId: game._id,
          color: isWhite ? 'white' : 'black',
        },
      });
    } else {
      // Add to queue
      matchmakingQueue.set(authUser.userId, {
        username: user.username,
        rating: user.rating,
        timeControl,
        timestamp: Date.now(),
      });

      // Set timeout to remove from queue after 60 seconds
      setTimeout(() => {
        matchmakingQueue.delete(authUser.userId);
      }, 60000);

      return NextResponse.json({
        success: true,
        data: { matched: false, message: 'Added to matchmaking queue' },
      });
    }
  } catch (error) {
    console.error('Matchmaking error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Cancel matchmaking
export async function DELETE(request: NextRequest) {
  try {
    const authUser = getUserFromRequest(request);

    if (!authUser) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    matchmakingQueue.delete(authUser.userId);

    return NextResponse.json({
      success: true,
      message: 'Removed from matchmaking queue',
    });
  } catch (error) {
    console.error('Cancel matchmaking error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
