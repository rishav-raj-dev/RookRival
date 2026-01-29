import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Game from '@/models/Game';
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

    // Get all games (completed and active) for this user
    const games = await Game.find({
      $or: [
        { whitePlayer: authUser.userId },
        { blackPlayer: authUser.userId },
      ],
      status: { $in: ['completed', 'active'] },
    })
      .populate('whitePlayer', 'username rating')
      .populate('blackPlayer', 'username rating')
      .populate('winner', 'username rating')
      .sort({ updatedAt: -1 })
      .limit(50);

    return NextResponse.json({
      success: true,
      data: { games },
    });
  } catch (error) {
    console.error('Get games history error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
