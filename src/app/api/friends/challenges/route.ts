import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Challenge from '@/models/Challenge';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authUser = getUserFromRequest(request);

    if (!authUser) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    // Get all pending challenges where the user is challenged
    const receivedChallenges = await Challenge.find({
      challenged: authUser.userId,
      status: 'pending',
      expiresAt: { $gt: new Date() }, // Not expired
    })
      .populate('challenger', 'username rating')
      .populate('challenged', 'username rating')
      .sort({ createdAt: -1 });

    // Get all pending challenges the user has sent
    const sentChallenges = await Challenge.find({
      challenger: authUser.userId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })
      .populate('challenger', 'username rating')
      .populate('challenged', 'username rating')
      .sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      data: {
        receivedChallenges,
        sentChallenges,
      },
    });
  } catch (error) {
    console.error('Get challenges error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
