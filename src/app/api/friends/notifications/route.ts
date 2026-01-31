import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
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

    // Get pending friend requests count
    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const pendingFriendRequestsCount = user.friendRequests.filter(
      (req: any) => req.status === 'pending'
    ).length;

    // Get pending challenges count
    const pendingChallengesCount = await Challenge.countDocuments({
      challenged: authUser.userId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    const totalCount = pendingFriendRequestsCount + pendingChallengesCount;

    return NextResponse.json({
      success: true,
      data: {
        pendingFriendRequests: pendingFriendRequestsCount,
        pendingChallenges: pendingChallengesCount,
        total: totalCount,
      },
    });
  } catch (error) {
    console.error('Get notifications count error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
