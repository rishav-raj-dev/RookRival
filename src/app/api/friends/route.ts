import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
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

    const user = await User.findById(authUser.userId)
      .populate('friends', 'username rating')
      .populate('friendRequests.from', 'username rating');

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Filter only pending requests
    const pendingRequests = user.friendRequests.filter(
      (req: any) => req.status === 'pending'
    );

    return NextResponse.json({
      success: true,
      data: {
        friends: user.friends,
        pendingRequests,
      },
    });
  } catch (error) {
    console.error('Get friends error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
