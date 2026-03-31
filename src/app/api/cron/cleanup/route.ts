import { cleanupExpiredOvertime } from "@/lib/over-time/overtime-status-actions";
import { NextResponse } from "next/server";

// บังคับให้เป็น Dynamic เสมอเพื่อไม่ให้โดน Cache
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // สั่งให้คนทำงาน (ใน lib) เริ่มงาน
    const result = await cleanupExpiredOvertime();
    
    return NextResponse.json({ 
      success: true, 
      message: "Cleanup completed",
      data: result 
    });
  } catch (error) {
    console.error("Cron Job Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}