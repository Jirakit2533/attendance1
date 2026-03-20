"use server";

import { db } from "@/db/db"; 
import { attendanceTable, shiftsTable, temporaryShiftsTable } from "@/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ดึงข้อมูลประวัติการเข้างานพร้อมข้อมูลกะงาน
export async function getAttendanceHistory(userId: string) {
  return await db
    .select({
      id: attendanceTable.id,
      date: attendanceTable.date,
      checkIn: attendanceTable.checkIn,
      checkOut: attendanceTable.checkOut,
      imageIn: attendanceTable.imageIn,
      imageOut: attendanceTable.imageOut,
      locationIn: attendanceTable.locationIn,
      isLate: attendanceTable.isLate,
      isEarlyExit: attendanceTable.isEarlyExit,
      // ดึงเวลาจากกะปกติหรือกะพิเศษ
      startTime: sql`COALESCE(${temporaryShiftsTable.endTime}, ${shiftsTable.startTime})`,
      endTime: sql`COALESCE(${temporaryShiftsTable.endTime}, ${shiftsTable.endTime})`,
    })
    .from(attendanceTable)
    .leftJoin(shiftsTable, eq(attendanceTable.shift_id, shiftsTable.id))
    .leftJoin(temporaryShiftsTable, eq(attendanceTable.temp_shift_id, temporaryShiftsTable.id))
    .where(eq(attendanceTable.user_id, userId))
    .orderBy(desc(attendanceTable.date))
    .limit(30);
}

// บันทึกเข้างาน
export async function checkInAction(userId: string, imageIn: string, locationIn: string) {
  try {
    const today = new Date().toISOString().split('T')[0];

    await db.insert(attendanceTable).values({
      user_id: userId,
      date: today,
      checkIn: sql`timezone('UTC', now())::time`,
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
        checkOut: sql`timezone('UTC', now())::time`,
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
    console.error("Check-out Error:", error);
    return { success: false, message: "ไม่สามารถบันทึกเวลาออกงานได้" };
  }
}