// lib/overtime-calculate.ts

export type OTRoundingOption = "EVERY_30_MINS" | "EVERY_1_HOUR" | "ACTUAL";

interface OTInput {
  checkIn: string | null;       // เวลาเข้างานจริง (จาก DB)
  checkOut: string;             // เวลาออกงานจริง (จาก process: now)
  shiftStart: string | null;    // เวลาเริ่มงานตามกะ (เพื่อใช้ตรวจสอบกรณีข้ามคืน)
  shiftEnd: string | null;      // เวลาเลิกงานตามกะ (Active End Time)
  roundingMode: OTRoundingOption; // โหมดการตัดเวลาที่ต้องการใช้
}

export const calculateOvertime = ({
  checkIn,
  checkOut,
  shiftStart,
  shiftEnd,
  roundingMode,
}: OTInput) => {
  // ตรวจสอบความครบถ้วนของข้อมูล
  if (!checkIn || !shiftEnd || !shiftStart) {
    return { totalMinutes: 0, totalHours: 0, rawMinutes: 0, beforeMinutes: 0, afterMinutes: 0 };
  }

  // Helper ฟังก์ชันสำหรับแปลง "HH:mm" เป็นนาทีรวมทั้งหมดของวัน
  const toMin = (time: string | null) => {
    if (!time || typeof time !== 'string') return 0;
    const [h, m] = time.split(":").map(Number);
    return h * 60 + (m || 0);
  };

  let actualIn = toMin(checkIn);
  let actualOut = toMin(checkOut);
  let planStart = toMin(shiftStart);
  let planEnd = toMin(shiftEnd);

  // --- Logic รองรับกะกลางคืน (Night Shift Support) ---
  
  // 1. ถ้าเวลาเลิกงานตามกะ น้อยกว่าเวลาเริ่มงาน แปลว่าเป็นกะข้ามคืน
  if (planEnd < planStart) {
    planEnd += 1440;
  }

  // 2. ถ้าเวลาออกงานจริง น้อยกว่าเวลาเข้างานจริง (สแกนออกหลังเที่ยงคืน)
  if (actualOut < actualIn) {
    actualOut += 1440;
  }

  // 3. กรณีพิเศษ: กะดึกแต่มาสายจนเช็คอินหลังเที่ยงคืน (เช่น กะเริ่ม 22:00 เข้างาน 01:00)
  // ถ้าเข้างานช่วงเช้ามืด (00:00-05:00) และกะเริ่มช่วงดึก ให้ปรับเส้นเวลาเข้างานจริง
  if (actualIn < 300 && planStart > 1000) {
    actualIn += 1440;
    // หากบวกเข้างานแล้ว เวลาออกก็ต้องบวกตามเพื่อให้สัมพันธ์กัน (ถ้ายังไม่ได้บวก)
    if (actualOut < 1440) actualOut += 1440;
  }

  // 1. คำนวณนาที OT ก่อนเริ่มงาน (Early Check-in)
  // เฉพาะกรณีที่เข้างานก่อนเวลาเริ่มกะเท่านั้น
  let beforeShiftOT = planStart > actualIn ? planStart - actualIn : 0;

  // 2. คำนวณนาที OT หลังเลิกงาน (Late Check-out)
  // เฉพาะกรณีที่ออกงานหลังเวลาเลิกกะเท่านั้น
  let afterShiftOT = actualOut > planEnd ? actualOut - planEnd : 0;

  // รวมนาที OT ทั้งหมดจากทั้งสองส่วน (ก่อนและหลัง) ก่อนนำไปปัดเศษ
  let rawOTMinutes = beforeShiftOT + afterShiftOT;

  let finalMinutes = 0;

  // 3. ประมวลผลการปัดเศษตาม Options ที่กำหนด
  switch (roundingMode) {
    case "EVERY_30_MINS":
      finalMinutes = Math.floor(rawOTMinutes / 30) * 30;
      break;

    case "EVERY_1_HOUR":
      finalMinutes = Math.floor(rawOTMinutes / 60) * 60;
      break;

    case "ACTUAL":
    default:
      finalMinutes = rawOTMinutes;
      break;
  }

  return {
    beforeMinutes: beforeShiftOT,    // จำนวนนาที OT ก่อนเข้างาน (ดิบ)
    afterMinutes: afterShiftOT,      // จำนวนนาที OT หลังเลิกงาน (ดิบ)
    rawMinutes: rawOTMinutes,        // จำนวนนาทีดิบรวมก่อนการปัด
    totalMinutes: finalMinutes,      // จำนวนนาทีสุทธิหลังปัดเศษ
    totalHours: parseFloat((finalMinutes / 60).toFixed(2)), // แปลงเป็นจำนวนชั่วโมงทศนิยม
  };
};