import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/db";
import { notificationDevicesTable } from "@/db/schema";
import { firebaseAdminMessaging } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "userId จำเป็นต้องมี",
        },
        { status: 400 }
      );
    }

    const devices = await db
      .select()
      .from(notificationDevicesTable)
      .where(
        eq(
          notificationDevicesTable.userId,
          userId
        )
      );

    if (devices.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "ไม่พบอุปกรณ์ที่ลงทะเบียนไว้",
        },
        { status: 404 }
      );
    }

    const results = [];

    for (const device of devices) {
      try {
        const messageId =
          await firebaseAdminMessaging.send({
            token: device.fcmToken,
            notification: {
              title: "ทดสอบแจ้งเตือน",
              body: "ระบบ Push Notification ทำงานแล้ว",
            },
          });

        results.push({
          fcmToken: device.fcmToken,
          success: true,
          messageId,
        });
      } catch (error) {
        console.error(
          "FCM send error:",
          error
        );

        results.push({
          fcmToken: device.fcmToken,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      deviceCount: devices.length,
      results,
    });
  } catch (error) {
    console.error(
      "Notification test error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "ไม่สามารถส่ง Test Notification ได้",
      },
      { status: 500 }
    );
  }
}