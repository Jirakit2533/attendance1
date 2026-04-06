import { db } from "@/db/db";
import { attendanceTable, overtimeTable, overtimeRequestsTable } from "@/db/schema";

async function seed() {
  console.log("🚀 Hard-Seeding with EXPLICIT IDs...");

  // --- ข้อมูลชุดศักดิ์สิทธิ์ที่มึงให้มา ---
  const userId = "f5d04153-0831-4865-965f-875f789602a3";
  const companyId = "168fa4f1-0dfa-4d62-88bc-1a175ef57858";
  const departmentId = "2bcd4623-b3b9-4bb5-9e77-994e7ecb5d63";
  const positionId = "9e17075d-798e-468f-a5cf-aa4cd202393d";
  const siteId = "aabbca45-6ef7-43b8-b92e-a4c06f210e95";

  const testDate = "2026-04-06";
  const attId = crypto.randomUUID();
  const mockLocation = "13.756310, 100.501810"; // อยู่ในระยะ 50m จาก Site แน่นอน

  try {
    // 1. ลงเวลาเข้า-ออก (Attendance)
    console.log("Step 1: Inserting Attendance...");
    await db.insert(attendanceTable).values({
      id: attId,
      user_id: userId,
      department_id: departmentId,
      site_id: siteId,
      date: testDate,
      checkIn: "08:00:00",
      checkOut: "19:00:00",
      // Snapshots
      siteInNameSnapshot: "สำนักงานหลัก (HQ)",
      siteCoordinatesSnapshot: "13.756300, 100.501800",
      shiftStartTimeSnapshot: "08:00:00",
      shiftEndTimeSnapshot: "17:00:00",
      departmentNameSnapshot: "IT Development",
      // Location & Image
      locationIn: mockLocation,
      locationOut: mockLocation,
      imageIn: "https://dummyimage.com/400x400/000/fff&text=IN",
      imageOut: "https://dummyimage.com/400x400/000/fff&text=OUT",
      // Statuses
      workingStatusEnum: "normal",
      isLate: 0,
      isEarlyExit: "0",
      isOffsiteIn: "0",
      isOffsiteOut: "0",
    });

    // 2. บันทึกผล OT ที่ระบบคำนวณได้ (Overtime Table)
    console.log("Step 2: Inserting Calculated Overtime...");
    await db.insert(overtimeTable).values({
      userId: userId,
      userName: "ชูวิทย์ กมลวิศิษฎ์",
      companyId: companyId,
      attendanceId: attId,
      date: testDate,
      overtimeBefore: 0,
      overtimeAfter: 120, // (19:00 - 17:00) = 2 ชม.
      overtimeCollected: 120,
      otRoundingOption: "ACTUAL",
      status: "pending",
    });

    // 3. บันทึกใบคำขอ OT ของพนักงาน (OT Request Table)
    console.log("Step 3: Inserting OT Request (60 mins)...");
    await db.insert(overtimeRequestsTable).values({
      userId: userId,
      userName: "ชูวิทย์ กมลวิศิษฎ์",
      companyId: companyId,
      departmentId: departmentId,
      siteId: siteId,
      date: testDate,
      timeStart: "17:30:00",
      timeEnd: "18:30:00",
      overtimeByRequest: 60, // ขอทำแค่ 1 ชม.
      reason: "ปั่นงาน Seed ให้เสร็จเพื่อ Test Cron",
      status: "pending", // รอหัวหน้าอนุมัติ
      requestedWorkers: [userId],
      createdBy: userId,
    });

    console.log("✅ [SUCCESS] Seed ข้อมูลสมบูรณ์แบบ!");
    console.log("💡 ข้อมูลพร้อมแล้วสำหรับการเทส Logic: min(Collected, Request)");
    process.exit(0);

  } catch (error: any) {
    console.error("❌ Seed Failed (Check Foreign Keys):");
    console.error("Error Message:", error.message);
    if (error.detail) console.error("Database Detail:", error.detail);
    process.exit(1);
  }
}

seed();
// คำสั่ง seed = bun --env-file=.env tsx src/db/seedTest.ts