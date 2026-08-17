// src/app/api/cron/cleanup-images/route.ts

import { NextResponse } from "next/server";
import { db } from "../../../../db/db"; 
import { attendanceTable, automationLogTable } from "../../../../db/schema"; // ปรับ Path ตามโครงสร้างโปรเจกต์ของคุณ
import { UTApi } from "uploadthing/server";
import { lt, and, or, isNotNull } from "drizzle-orm";

const utapi = new UTApi({
  token: process.env.UPLOADTHING_TOKEN,
});

export async function GET(req: Request) {
  const startTime = new Date();
  const currentDateStr = startTime.toISOString().split("T")[0]; // รูปแบบ YYYY-MM-DD
  const jobName = "cleanup-attendance-images";

  let readCount = 0;
  let deletedCount = 0;
  let status = "success";
  let errorDetails: any = null;

  try {
    // 1. ตรวจสอบความปลอดภัย (Security Check สำหรับ Cron Job เช่น GitHub Actions)
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

      // 5. สั่งลบไฟล์ออกจาก UploadThing (รองรับการลบแบบ Array ทีละหลายไฟล์)
      if (fileIdsToDelete.length > 0) {
        // UploadThing ลบได้สูงสุดครั้งละหลายไฟล์ (ตามขีดจำกัด SDK หรือตัดแบ่งย่อยถ้ามีจำนวนมาก)
        await utapi.deleteFiles(fileIdsToDelete);
        deletedCount = fileIdsToDelete.length;
      }

      // 6. เคลียร์ค่ารูปภาพใน Database เพื่อไม่ให้ลิงก์ที่ถูกลบไปแล้วแสดงผลซากรูปภาพบนเว็บ
      // (อัปเดตให้ imageIn / imageOut และ Key เป็นค่าว่างหรือ null)
      for (const id of attendanceIdsToUpdate) {
        await db
          .update(attendanceTable)
          .set({
            imageIn: "",
            imageInId: null,
            imageOut: null,
            imageOutId: null,
          })
          .where(lt(attendanceTable.id, id)); // หรือใช้ eq(attendanceTable.id, id)
      }
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    // 7. บันทึก Log ลง automation_logs สำเร็จ
    await db.insert(automationLogTable).values({
      jobName,
      date: currentDateStr,
      startAt: startTime,
      endAt: endTime,
      durationMs,
      readCount,
      changeCount: deletedCount,
      executedCount: deletedCount,
      deletedCount,
      status: "success",
      details: { message: `Successfully deleted ${deletedCount} files from ${readCount} attendance records.` },
    });

    return NextResponse.json({
      success: true,
      message: "Cleanup completed successfully",
      readCount,
      deletedCount,
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