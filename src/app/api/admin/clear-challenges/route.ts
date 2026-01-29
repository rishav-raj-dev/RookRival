import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Challenge from '@/models/Challenge';

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    // Delete all challenges
    const result = await Challenge.deleteMany({});

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.deletedCount} challenges`,
    });
  } catch (error) {
    console.error('Clear challenges error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
