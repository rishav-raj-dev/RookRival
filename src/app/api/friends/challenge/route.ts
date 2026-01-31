import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import Challenge from '@/models/Challenge';
import { getUserFromRequest } from '@/lib/auth';
import { TimeControl } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const authUser = getUserFromRequest(request);

    if (!authUser) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { friendId, timeControl } = await request.json();

    if (!friendId || !timeControl) {
      return NextResponse.json(
        { success: false, message: 'Friend ID and time control are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Verify friendship
    const currentUser = await User.findById(authUser.userId);
    if (!currentUser?.friends.includes(friendId)) {
      return NextResponse.json(
        { success: false, message: 'Not friends with this user' },
        { status: 400 }
      );
    }

    // Check if there's already a pending challenge between these users
    const existingChallenge = await Challenge.findOne({
      $or: [
        { challenger: authUser.userId, challenged: friendId, status: 'pending' },
        { challenger: friendId, challenged: authUser.userId, status: 'pending' }
      ]
    });

    if (existingChallenge) {
      return NextResponse.json(
        { success: false, message: 'A challenge is already pending with this user' },
        { status: 400 }
      );
    }

    // Create pending challenge
    const challenge = await Challenge.create({
      challenger: authUser.userId,
      challenged: friendId,
      timeControl,
      status: 'pending',
    });

    const populatedChallenge = await Challenge.findById(challenge._id)
      .populate('challenger', 'username rating')
      .populate('challenged', 'username rating');

    return NextResponse.json({
      success: true,
      data: { challenge: populatedChallenge },
      message: 'Challenge by ' + populatedChallenge.challenger.username,
    });
  } catch (error) {
    console.error('Challenge friend error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
