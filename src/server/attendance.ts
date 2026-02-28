"use server";

import { db } from "@/db"; // ปรับ path ตามโปรเจกต์คุณ
import { attendanceTable } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ดึงข้อมูลประวัติการเข้างาน (ใช้ใน Server Component)
export async function getAttendanceHistory(userId: string) {
  return await db.query.attendanceTable.findMany({
    where: eq(attendanceTable.user_id, userId),
    orderBy: [desc(attendanceTable.date)],
    limit: 30, // ดึงย้อนหลัง 30 รายการ
  });
}

// บันทึกเข้างาน
export async function checkInAction(userId: string, imageIn: string, locationIn: string) {
  try {
    const today = new Date().toISOString().split('T')[0];

    await db.insert(attendanceTable).values({
      user_id: userId,
      date: today,
      checkIn: new Date(),
      imageIn,
      locationIn,
    });

    revalidatePath("/employee");
    return { success: true };
  } catch (error) {
    console.error("Check-in Error:", error);
    return { success: false, message: "ไม่สามารถบันทึกเวลาเข้างานได้" };
  }
}

// บันทึกออกงาน
export async function checkOutAction(userId: string, imageOut: string, locationOut: string) {
  try {
    const today = new Date().toISOString().split('T')[0];

    await db.update(attendanceTable)
      .set({
        checkOut: new Date(),
        imageOut,
        locationOut,
      })
      .where(
        and(
          eq(attendanceTable.user_id, userId),
          eq(attendanceTable.date, today)
        )
      );

    revalidatePath("/employee");
    return { success: true };
  } catch (error) {
    return { success: false, message: "ไม่สามารถบันทึกเวลาออกงานได้" };
  }
}