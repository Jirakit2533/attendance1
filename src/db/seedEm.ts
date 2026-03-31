import { db } from "./db"; // ปรับให้ตรงกับตัวอย่างเดิมที่คุณใช้ (../db/db หรือ ./db)
import { usersTable, shiftsTable } from "./schema";
import bcrypt from "bcryptjs";

async function seedStaff() {
  console.log("🌱 กำลังเริ่ม Seed ข้อมูลพนักงาน 17 ท่าน...");

  const ADMIN_ID = "72f1cb06-9046-4226-9daf-4d75f21a2a0c";
  const COMPANY_ID = "abbb07ee-3b05-49f4-832a-41bded45a548";

  const staffList = [
    { username: "Ausasa", pass: "3333", fname: "อัษฎา", lname: "รณที" },
    { username: "Arnan", pass: "5555", fname: "อนันต์", lname: "ป้องภัย" },
    { username: "Punyaphon", pass: "6666", fname: "ปุณยาพร", lname: "ขุมเงิน" },
    { username: "Worapon", pass: "7777", fname: "วรพล", lname: "เสียงล้ำ" },
    { username: "Nichaluk", pass: "8888", fname: "ณิชาลักษณ์", lname: "ทรงปาญาติ" },
    { username: "Jeerawet", pass: "9999", fname: "จีระวัฒน์", lname: "ชื่นศิริ" },
    { username: "Ronnakorn", pass: "1100", fname: "รณกร", lname: "ฤาโสภา" },
    { username: "Rangwan", pass: "1122", fname: "รางวัล", lname: "ฮวดมา" },
    { username: "Natthaporn", pass: "1133", fname: "ณัฐฐาพร", lname: "พินเกตุ" },
    { username: "Benjamat", pass: "1144", fname: "เบญจมาศ", lname: "ชุมสีวัน" },
    { username: "Munita", pass: "1155", fname: "มุนิดา", lname: "พึ่งทอง" },
    { username: "Thitinan", pass: "1166", fname: "ฐิตินันท์", lname: "ชำนาญไทย" },
    { username: "Phusin", pass: "1177", fname: "ภูสิน", lname: "นิลสนธิ" },
    { username: "Pisit", pass: "1188", fname: "พิสิษฐ์", lname: "นาคสมบูรณ์(วิทย์)" },
    { username: "Parkaydrow", pass: "1199", fname: "ประกายดาว", lname: "วงษ์สนิท (แนน)" },
    { username: "Phadungkiat", pass: "2223", fname: "ผดุงเกียรติ", lname: "โชติช่วง (ต้น)" },
    { username: "Kasidis", pass: "2233", fname: "กษิดิศ", lname: "สายอ๋อง (น้องเบส)" },
  ];

  for (const item of staffList) {
    try {
      // 1. Hash Password
      const hashedPassword = await bcrypt.hash(item.pass, 10);

      // 2. Insert User
      const [insertedUser] = await db.insert(usersTable).values({
        userName: item.username,
        passwordHash: hashedPassword,
        firstName: item.fname,
        lastName: item.lname,
        role: "employee",
        companyId: COMPANY_ID,
        createdBy: ADMIN_ID,
        updateBy: ADMIN_ID,
        updatedAt: new Date(),
      }).returning({ id: usersTable.id });

      // 3. Insert Shift (เลียนแบบ Logic ใน saveStaffAction)
      if (insertedUser) {
        await db.insert(shiftsTable).values({
          userId: insertedUser.id,
          name: "-",
          startTime: "08:00", // ตั้งค่าเริ่มต้น
          endTime: "17:00",   // ตั้งค่าเริ่มต้น
          companyId: COMPANY_ID,
          updatedAt: new Date(),
        });
        console.log(`✅ สำเร็จ: ${item.username} (${item.fname})`);
      }
    } catch (error: any) {
      console.error(`❌ พลาด: ${item.username} -`, error.message);
    }
  }

  console.log("🏁 Seed ข้อมูลพนักงานทั้งหมดเรียบร้อย!");
}

seedStaff();