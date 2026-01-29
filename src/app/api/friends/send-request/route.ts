import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
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

    const { targetUserId } = await request.json();

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, message: 'Target user ID is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Check if already friends
    const currentUser = await User.findById(authUser.userId);
    if (currentUser?.friends.includes(targetUserId)) {
      return NextResponse.json(
        { success: false, message: 'Already friends with this user' },
        { status: 400 }
      );
    }

    // Check if request already sent
    if (currentUser?.sentFriendRequests.includes(targetUserId)) {
      return NextResponse.json(
        { success: false, message: 'Friend request already sent' },
        { status: 400 }
      );
    }

    // Check if there's a pending request from target user
    const existingRequest = targetUser.friendRequests.find(
      (req: any) => req.from.toString() === authUser.userId && req.status === 'pending'
    );

    if (existingRequest) {
      return NextResponse.json(
        { success: false, message: 'This user has already sent you a friend request' },
        { status: 400 }
      );
    }

    // Add to target user's friend requests
    await User.findByIdAndUpdate(targetUserId, {
      $push: {
        friendRequests: {
          from: authUser.userId,
          status: 'pending',
          createdAt: new Date(),
        },
      },
    });

    // Add to current user's sent requests
    await User.findByIdAndUpdate(authUser.userId, {
      $push: { sentFriendRequests: targetUserId },
    });

    return NextResponse.json({
      success: true,
      message: 'Friend request sent successfully',
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
