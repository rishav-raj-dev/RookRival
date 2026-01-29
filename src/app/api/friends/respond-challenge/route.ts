import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Challenge from '@/models/Challenge';
import Game from '@/models/Game';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authUser = getUserFromRequest(request);

    if (!authUser) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { challengeId, action } = await request.json();

    if (!challengeId || !action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Challenge ID and valid action required' },
        { status: 400 }
      );
    }

    await connectDB();

    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      return NextResponse.json(
        { success: false, message: 'Challenge not found' },
        { status: 404 }
      );
    }

    // Verify the user is the challenged person
    if (challenge.challenged.toString() !== authUser.userId) {
      return NextResponse.json(
        { success: false, message: 'You are not authorized to respond to this challenge' },
        { status: 403 }
      );
    }

    // Check if challenge is still pending
    if (challenge.status !== 'pending') {
      return NextResponse.json(
        { success: false, message: 'Challenge is no longer pending' },
        { status: 400 }
      );
    }

    // Check if challenge has expired
    if (new Date() > challenge.expiresAt) {
      challenge.status = 'expired';
      await challenge.save();
      return NextResponse.json(
        { success: false, message: 'Challenge has expired' },
        { status: 400 }
      );
    }

    if (action === 'reject') {
      challenge.status = 'rejected';
      await challenge.save();
      return NextResponse.json({
        success: true,
        data: {
          challengerId: challenge.challenger.toString(),
        },
        message: 'Challenge rejected',
      });
    }

    // Accept challenge - create game
    challenge.status = 'accepted';

    // Calculate time in seconds
    const timeControl = challenge.timeControl;
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
      whitePlayer: isWhite ? challenge.challenger : challenge.challenged,
      blackPlayer: isWhite ? challenge.challenged : challenge.challenger,
      timeControl,
      whiteTimeRemaining: timeInSeconds,
      blackTimeRemaining: timeInSeconds,
      status: 'active',
      startedAt: new Date(),
      moves: [],
      capturedPieces: { white: [], black: [] },
    });

    challenge.gameId = game._id;
    await challenge.save();

    return NextResponse.json({
      success: true,
      data: { 
        gameId: game._id.toString(),
        challengerId: challenge.challenger.toString(),
      },
      message: 'Challenge accepted',
    });
  } catch (error) {
    console.error('Respond to challenge error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
