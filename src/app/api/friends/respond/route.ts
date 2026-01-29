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

    const { requesterId, action } = await request.json();

    if (!requesterId || !action) {
      return NextResponse.json(
        { success: false, message: 'Requester ID and action are required' },
        { status: 400 }
      );
    }

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json(
        { success: false, message: 'Invalid action' },
        { status: 400 }
      );
    }

    await connectDB();

    const currentUser = await User.findById(authUser.userId);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Find the friend request
    const requestIndex = currentUser.friendRequests.findIndex(
      (req: any) => req.from.toString() === requesterId && req.status === 'pending'
    );

    if (requestIndex === -1) {
      return NextResponse.json(
        { success: false, message: 'Friend request not found' },
        { status: 404 }
      );
    }

    if (action === 'accept') {
      // Add to both users' friends lists
      await User.findByIdAndUpdate(authUser.userId, {
        $push: { friends: requesterId },
      });

      await User.findByIdAndUpdate(requesterId, {
        $push: { friends: authUser.userId },
        $pull: { sentFriendRequests: authUser.userId },
      });

      // Update request status
      currentUser.friendRequests[requestIndex].status = 'accepted';
      await currentUser.save();

      return NextResponse.json({
        success: true,
        message: 'Friend request accepted',
      });
    } else {
      // Reject - just update status and remove from sent requests
      currentUser.friendRequests[requestIndex].status = 'rejected';
      await currentUser.save();

      await User.findByIdAndUpdate(requesterId, {
        $pull: { sentFriendRequests: authUser.userId },
      });

      return NextResponse.json({
        success: true,
        message: 'Friend request rejected',
      });
    }
  } catch (error) {
    console.error('Respond to friend request error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
