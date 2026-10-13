// src/app/api/cron/cleanup-images/route.ts

import { NextResponse } from "next/server";
import { db } from "../../../../db/db"; 
import { attendanceTable, automationLogTable } from "../../../../db/schema"; // ปรับ Path ตามโครงสร้างโปรเจกต์ของคุณ
import { UTApi } from "uploadthing/server";
import { lt, and, or, isNotNull, inArray } from "drizzle-orm";

const utapi = new UTApi({
  token: process.env.UPLOADTHING_TOKEN,
});

// ฟังก์ชันช่วยแบ่งข้อมูลเป็นชุดย่อย (Chunking) เพื่อป้องกันข้อจำกัดเรื่องขนาด Request และ Timeout
function chunkArray<T>(array: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export async function GET(req: Request) {
  const startTime = new Date();
  const currentDateStr = startTime.toISOString().split("T")[0]; // รูปแบบ YYYY-MM-DD
  const jobName = "cleanup-attendance-images";

  let readCount = 0;
  let deletedFileCount = 0;
  let updatedRecordCount = 0;
  let status = "success";
  let errorDetails: any = null;

  try {
    // 1. ตรวจสอบความปลอดภัย
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. คำนวณวันที่ย้อนหลัง 60 วัน
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // 3. ค้นหาข้อมูล Attendance ที่เก่ากว่า 60 วัน และยังมีรูปภาพค้างอยู่
    const oldAttendances = await db
      .select({
        id: attendanceTable.id,
        imageInId: attendanceTable.imageInId,
        imageOutId: attendanceTable.imageOutId,
      })
      .from(attendanceTable)
      .where(
        and(
          lt(attendanceTable.createdAt, sixtyDaysAgo),
          or(
            isNotNull(attendanceTable.imageInId),
            isNotNull(attendanceTable.imageOutId)
          )
        )
      );

    readCount = oldAttendances.length;

    if (readCount > 0) {
      // 4. รวบรวม File IDs ทั้งหมดที่ต้องลบ
      const fileIdsToDelete: string[] = [];
      const attendanceIdsToUpdate: string[] = [];

      for (const record of oldAttendances) {
        if (record.imageInId) fileIdsToDelete.push(record.imageInId);
        if (record.imageOutId) fileIdsToDelete.push(record.imageOutId);
        attendanceIdsToUpdate.push(record.id);
      }

      // 5. สั่งลบไฟล์ออกจาก UploadThing (แบ่งลบทีละ 500 ไฟล์ ป้องกัน API Rate Limit/Timeout)
      if (fileIdsToDelete.length > 0) {
        const fileChunks = chunkArray(fileIdsToDelete, 500);
        for (const chunk of fileChunks) {
          const utResponse = await utapi.deleteFiles(chunk);
          if (utResponse) {
            deletedFileCount += chunk.length;
          }
        }
      }

      // 6. เคลียร์ค่ารูปภาพใน Database (Batch Update ทีเดียว ป้องกัน N+1 Query และ Database Overload)
      if (attendanceIdsToUpdate.length > 0) {
        const dbChunks = chunkArray(attendanceIdsToUpdate, 500);
        for (const chunk of dbChunks) {
          await db
            .update(attendanceTable)
            .set({
              imageIn: "", // หรือ null ตามโครงสร้าง Schema เดิมของคุณ
              imageInId: null,
              imageOut: null,
              imageOutId: null,
            })
            .where(inArray(attendanceTable.id, chunk)); // ใช้ inArray แทนการวนลูปทีละแถว
          
          updatedRecordCount += chunk.length;
        }
      }
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    // 7. บันทึก Log สำเร็จ
    await db.insert(automationLogTable).values({
      jobName,
      date: currentDateStr,
      startAt: startTime,
      endAt: endTime,
      durationMs,
      readCount,
      changeCount: updatedRecordCount,
      executedCount: deletedFileCount,
      deletedCount: deletedFileCount,
      status: "success",
      details: { 
        message: `Successfully deleted ${deletedFileCount} files from ${updatedRecordCount} attendance records.` 
      },
    });

    return NextResponse.json({
      success: true,
      message: "Cleanup completed successfully",
      readCount,
      deletedFileCount,
      updatedRecordCount,
    });

  } catch (error: any) {
    status = "error";
    errorDetails = { message: error.message, stack: error.stack };
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    // บันทึก Log กรณีเกิดข้อผิดพลาด
    try {
      await db.insert(automationLogTable).values({
        jobName,
        date: currentDateStr,
        startAt: startTime,
        endAt: endTime,
        durationMs,
        readCount,
        changeCount: 0,
        executedCount: 0,
        deletedCount: 0,
        status: "error",
        retryCount: 0,
        details: errorDetails,
      });
    } catch (logError) {
      console.error("Failed to write automation log:", logError);
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}