import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/db";
import { notificationDevicesTable } from "@/db/schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { userId, installationId, userAgent } = body;

    if (!userId || !installationId) {
      return NextResponse.json(
        {
          success: false,
          message: "userId และ installationId จำเป็นต้องมี",
        },
        { status: 400 }
      );
    }

    const existingDevice = await db
      .select()
      .from(notificationDevicesTable)
      .where(
        eq(
          notificationDevicesTable.installationId,
          installationId
        )
      )
      .limit(1);

    if (existingDevice.length > 0) {
      await db
        .update(notificationDevicesTable)
        .set({
          userId,
          userAgent: userAgent ?? null,
        })
        .where(
          eq(
            notificationDevicesTable.installationId,
            installationId
          )
        );

      return NextResponse.json({
        success: true,
        message: "อัปเดตอุปกรณ์เรียบร้อย",
      });
    }

    await db.insert(notificationDevicesTable).values({
      userId,
      installationId,
      userAgent: userAgent ?? null,
    });

    return NextResponse.json({
      success: true,
      message: "ลงทะเบียนอุปกรณ์เรียบร้อย",
    });
  } catch (error) {
    console.error("Notification device register error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "ไม่สามารถลงทะเบียนอุปกรณ์ได้",
      },
      { status: 500 }
    );
  }
}