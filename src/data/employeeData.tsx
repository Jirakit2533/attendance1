// src/data/employeesData.ts

// --- 1. ข้อมูลบริษัท (Companies) 10 รายการ ---
export const dummyCompanies = Array.from({ length: 10 }, (_, i) => {
  const idNum = i + 1;
  const codes = ["TSF", "SRS", "Gテック", "LNK", "MEC", "LOG", "CON", "ADV", "BIZ", "KBT"];
  const names = [
    "Thai Smart Factory", "Siam Royal Systems", "Global Tech Solutions", 
    "Link Innovation", "Mega Engineering", "Logistics Pro", 
    "Construct Hub", "Advance Service", "Biz Power", "KBT Group"
  ];
  return {
    id: `COMP-${idNum.toString().padStart(3, "0")}`,
    name: names[i % names.length],
    code: codes[i % codes.length],
    status: i % 4 === 0 ? "suspended" : "active" as "active" | "suspended",
    phone: `02-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
    email: `contact@${codes[i % codes.length].toLowerCase()}.co.th`,
    address: `${Math.floor(10 + Math.random() * 90)}/1 ถนนสุขุมวิท กรุงเทพมหานคร`,
    siteCount: Math.floor(Math.random() * 10) + 1,
    adminCount: Math.floor(Math.random() * 3) + 1,
    leaderCount: Math.floor(Math.random() * 15) + 5,
    staffCount: Math.floor(Math.random() * 200) + 50,
    createdAt: new Date(2025, 0, idNum).toISOString(),
  };
});

// --- 2. ข้อมูลแอดมิน (Admins) 15 รายการ ---
export const dummyAdmins = Array.from({ length: 15 }, (_, i) => {
  const idNum = i + 1;
  const company = dummyCompanies[i % dummyCompanies.length];
  return {
    id: `ADM-${idNum.toString().padStart(3, "0")}`,
    companyId: company.id,
    name: `แอดมิน_${idNum} (HR)`,
    username: `admin.${idNum}`,
    password: "password123",
    email: `admin${idNum}@${company.code.toLowerCase()}.com`,
    avatar: `https://i.pravatar.cc/150?u=adm${idNum}`,
    status: "active" as "active" | "suspended",
    siteCount: company.siteCount,
    leaderManaged: Math.floor(company.leaderCount / company.adminCount),
    staffManaged: Math.floor(company.staffCount / company.adminCount),
    createdAt: new Date(2025, 1, idNum).toISOString(),
  };
});

// --- 3. ข้อมูลพนักงาน (Employees) 100 คน ---
export const dummyEmployees = Array.from({ length: 100 }, (_, i) => {
  const idNum = i + 1;
  const sites = ["สำนักงานใหญ่", "ไซต์งาน A (กรุงเทพ)", "ไซต์งาน B (นนทบุรี)"];
  const depts = ["IT", "HR", "Operations", "Sales", "Engineering"];
  const isLeader = idNum % 5 === 0; // ทุกๆ 5 คนเป็นหัวหน้า
  const site = sites[i % sites.length];
  const dept = depts[i % depts.length];
  
  return {
    id: `EMP-${idNum.toString().padStart(3, "0")}`,
    firstName: isLeader ? `หัวหน้า_${idNum}` : `พนักงาน_${idNum}`,
    lastName: `นามสกุล_${idNum}`,
    name: (isLeader ? `หัวหน้า_${idNum}` : `พนักงาน_${idNum}`) + ` นามสกุล_${idNum}`,
    department: dept,
    position: isLeader ? `Manager (${dept})` : `Staff (${dept})`,
    site: site,
    leaderAccess: isLeader ? "หัวหน้า" : "พนักงาน",
    avatar: `https://i.pravatar.cc/150?u=${idNum}`,
    username: `user.${idNum}`,
    password: "password123",
  };
});

// --- 4. ข้อมูลการลงชื่อทำงาน (Attendance) 100 รายการ ---
export const dummyAttendance = Array.from({ length: 100 }, (_, i) => {
  const emp = dummyEmployees[i % 100];
  const hour = Math.floor(Math.random() * (9 - 7 + 1)) + 7; // สุ่มเวลาเข้างาน 07:00 - 09:00
  const min = Math.floor(Math.random() * 60);
  return {
    id: i + 1,
    employee: emp.name,
    date: "2026-02-27",
    checkIn: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
    checkOut: "17:30",
    location: "13.7500, 100.5200",
    image: `https://i.pravatar.cc/150?u=att${i}`,
  };
});

// --- 5. ข้อมูลการลางาน (Leaves) 100 รายการ ---
export const dummyLeaves = Array.from({ length: 100 }, (_, i) => {
  const emp = dummyEmployees[i % 100];
  const types = ["ลากิจ", "ลาพักร้อน", "ลาป่วย"];
  const statuses = ["pending", "approved", "rejected"];
  return {
    id: i + 1,
    employee: emp.name,
    type: types[i % types.length],
    date: `2026-03-${((i % 28) + 1).toString().padStart(2, '0')}`,
    reason: i % 3 === 0 ? "มีอาการไข้สูง" : "ติดต่อธุระครอบครัว",
    status: statuses[i % 3],
  };
});