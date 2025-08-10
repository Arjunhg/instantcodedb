import { type NextRequest, NextResponse } from "next/server"
import { semanticCache } from "@/lib/semantic-cache"

export async function GET(request: NextRequest) {
  try {
    const stats = await semanticCache.getCacheStats();
    
    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        oldestEntryAge: stats.oldestEntry ? Date.now() - stats.oldestEntry : 0,
        newestEntryAge: stats.newestEntry ? Date.now() - stats.newestEntry : 0,
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get cache stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}