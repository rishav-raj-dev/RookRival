import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Game from '@/models/Game';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = getUserFromRequest(request);

    if (!authUser) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const game = await Game.findById(params.id)
      .populate('whitePlayer', 'username rating')
      .populate('blackPlayer', 'username rating')
      .populate('winner', 'username rating');

    if (!game) {
      return NextResponse.json(
        { success: false, message: 'Game not found' },
        { status: 404 }
      );
    }

    // Check if user is part of this game
    const isPlayerInGame = 
      game.whitePlayer._id.toString() === authUser.userId ||
      game.blackPlayer._id.toString() === authUser.userId;

    if (!isPlayerInGame) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized to view this game' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { game },
    });
  } catch (error) {
    console.error('Get game error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
