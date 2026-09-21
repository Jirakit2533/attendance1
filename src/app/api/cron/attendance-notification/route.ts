import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    if (
      cronSecret &&
      authorization !== `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const startTime = new Date();

    console.log(
      "[Attendance Notification] Cron started:",
      startTime.toISOString()
    );

    // TODO:
    // 1. ตรวจเวลาพนักงาน
    // 2. ตรวจ Attendance
    // 3. ตรวจว่าถึงจุดแจ้งเตือนหรือไม่
    // 4. ค้นหา FCM token
    // 5. ส่ง Notification ผ่าน Firebase Admin

    return NextResponse.json({
      success: true,
      message: "Attendance notification cron ทำงานแล้ว",
      timestamp: startTime.toISOString(),
    });
  } catch (error) {
    console.error(
      "[Attendance Notification] Cron error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "เกิดข้อผิดพลาดในการทำงาน",
      },
      { status: 500 }
    );
  }
}