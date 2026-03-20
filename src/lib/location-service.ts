import { db } from "@/db/db"; 
import { sitesTable, attendanceTable, usersTable } from "@/db/schema"; 
import { and, eq, sql, ne, isNull, desc } from "drizzle-orm"; 

// รัศมีประมาณ 10 เมตร (รวมกรอบเป็น 20x20 เมตร)
const OFFSET_10M = 0.00009; 

/**
 * 1. ฟังก์ชันสำหรับเช็คว่าพิกัดอยู่ในกรอบหรือไม่
 */
export const isInsideBound = (
  userLat: number | string, 
  userLon: number | string, 
  siteLat: number | string, 
  siteLon: number | string
) => {
  const uLat = typeof userLat === "string" ? parseFloat(userLat.trim()) : userLat;
  const uLon = typeof userLon === "string" ? parseFloat(userLon.trim()) : userLon;
  const sLat = typeof siteLat === "string" ? parseFloat(siteLat.trim()) : siteLat;
  const sLon = typeof siteLon === "string" ? parseFloat(siteLon.trim()) : siteLon;

  if (isNaN(uLat) || isNaN(uLon) || isNaN(sLat) || isNaN(sLon)) return false;

  return (
    uLat >= sLat - OFFSET_10M &&
    uLat <= sLat + OFFSET_10M &&
    uLon >= sLon - OFFSET_10M &&
    uLon <= sLon + OFFSET_10M
  );
};

/**
 * 2. ฟังก์ชันหลักสำหรับหา "ไซต์งานผู้ชนะ" (Check-in)
 * ปรับปรุง: รองรับ siteInNameSnapshot และบันทึก "ไม่ตรงไซต์" หากอยู่นอกเขต
 */
export const validateAndGetSite = async (
  userLat: number | string,
  userLon: number | string,
  companyId: string, 
  fixedSiteId: string | null
) => {
  let winnerSite: any = null;
  let isEverySiteUser = false;
  let isOffsiteIn = "0";
  let OffsiteCheckInConfirm = false; // ตั้งค่าเริ่มต้นเป็น false

  // --- ขั้นตอนที่ 1: ตรวจสอบสถานะ User ว่าผูกกับ "ทุกไซต์" หรือไม่ ---
  if (fixedSiteId && fixedSiteId !== "") {
    const site = await db.query.sitesTable.findFirst({
      where: eq(sitesTable.id, fixedSiteId),
    });

    if (site?.name === "ทุกไซต์") {
      isEverySiteUser = true;
    }
  }

  // --- ขั้นตอนที่ 2: กวาดหาไซต์จริงจากฐานข้อมูล ---
  const allActualSites = await db.query.sitesTable.findMany({
    where: ne(sitesTable.name, "ทุกไซต์")
  }); 

  const actualLocationSite = allActualSites.find(site => {
    if (!site.coordinates) return false;
    const [sLat, sLon] = site.coordinates.split(',').map(s => s.trim());
    return isInsideBound(userLat, userLon, sLat, sLon);
  });

  // --- ขั้นตอนที่ 3: ตัดสินผู้ชนะตาม Logic ใหม่ ---
  if (isEverySiteUser) {
    if (actualLocationSite) {
      winnerSite = { ...actualLocationSite };
      isOffsiteIn = "0";
    } else {
      // กลุ่มทุกไซต์ แต่อยู่นอกเขต: ใช้ไซต์แรกเป็น Reference แต่เปลี่ยนชื่อเป็น "ไม่ตรงไซต์"
      winnerSite = { ...allActualSites[0], name: "ไม่ตรงไซต์" }; 
      isOffsiteIn = "1";
    }
    OffsiteCheckInConfirm = false;
  } else {
    if (fixedSiteId) {
      const site = await db.query.sitesTable.findFirst({ where: eq(sitesTable.id, fixedSiteId) });
      if (site && site.coordinates) {
        const [sLat, sLon] = site.coordinates.split(',').map(s => s.trim());
        const isInside = isInsideBound(userLat, userLon, sLat, sLon);
        
        isOffsiteIn = isInside ? "0" : "1";
        winnerSite = { 
          ...site, 
          name: isInside ? site.name : "ไม่ตรงไซต์" // บันทึกลง siteInNameSnapshot
        };
        OffsiteCheckInConfirm = false;
      }
    }
  }

  if (!winnerSite) throw new Error("ไม่พบข้อมูลไซต์งานที่ถูกต้อง");

  // คืนค่า winnerSite พร้อมข้อมูลการอยู่นอกเขต
  return {
    ...winnerSite,
    isOffsiteIn,
    OffsiteCheckInConfirm,
    userCoordinates: `${userLat}, ${userLon}`
  };
};

/**
 * 3. ฟังก์ชันสำหรับ Validate พิกัดตอนเช็คเอาท์ (Check-out)
 * ปรับปรุง: รองรับ siteOutNameSnapshot และส่งชื่อ "ไม่ตรงไซต์" หากอยู่นอกเขต
 */
export const validateCheckOutLocation = async (
  userId: string,
  userLat: number | string,
  userLon: number | string,
  currentRecord: any 
) => {
  const userProfile = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });

  const mainSite = await db.query.sitesTable.findFirst({
    where: eq(sitesTable.id, userProfile?.site_id || ""),
  });
  
  const isEverySiteUser = mainSite?.name === "ทุกไซต์";

  if (isEverySiteUser) {
    const allActualSites = await db.query.sitesTable.findMany({
      where: ne(sitesTable.name, "ทุกไซต์")
    });

    const isAtAnySite = allActualSites.some(site => {
      if (!site.coordinates) return false;
      const [sLat, sLon] = site.coordinates.split(',').map(s => s.trim());
      return isInsideBound(userLat, userLon, sLat, sLon);
    });

    const isOffsiteOut = isAtAnySite ? "0" : "1";
    return { 
      isOffsiteOut, 
      isOffsiteOutCoordinates: `${userLat}, ${userLon}`, 
      OffsiteCheckOutConfirm: false,
      // บันทึกลง siteOutNameSnapshot
      siteOutName: isOffsiteOut === "1" ? "ไม่ตรงไซต์" : (currentRecord?.siteInNameSnapshot || "ทุกไซต์")
    };
  }

  if (!currentRecord?.site_id) {
    return { 
      isOffsiteOut: "1", 
      isOffsiteOutCoordinates: `${userLat}, ${userLon}`, 
      OffsiteCheckOutConfirm: false,
      siteOutName: "ไม่ตรงไซต์"
    };
  }

  const siteInDb = await db.query.sitesTable.findFirst({
    where: eq(sitesTable.id, currentRecord.site_id),
  });

  if (siteInDb && siteInDb.coordinates) {
    const [sLat, sLon] = siteInDb.coordinates.split(',').map(s => s.trim());
    const isInside = isInsideBound(userLat, userLon, sLat, sLon);
    const isOffsiteOut = isInside ? "0" : "1";

    return { 
      isOffsiteOut, 
      isOffsiteOutCoordinates: `${userLat}, ${userLon}`, 
      OffsiteCheckOutConfirm: false,
      // บันทึกลง siteOutNameSnapshot
      siteOutName: isOffsiteOut === "1" ? "ไม่ตรงไซต์" : (currentRecord?.siteInNameSnapshot || siteInDb.name)
    };
  }

  throw new Error("ไม่พบข้อมูลพิกัดไซต์งานสำหรับการตรวจสอบ");
};

// import { db } from "@/db/db"; 
// import { sitesTable, attendanceTable, usersTable } from "@/db/schema"; 
// import { and, eq, sql, ne, isNull, desc } from "drizzle-orm"; 

// // รัศมีประมาณ 10 เมตร (รวมกรอบเป็น 20x20 เมตร)
// const OFFSET_10M = 0.00009; 

// /**
//  * 1. ฟังก์ชันสำหรับเช็คว่าพิกัดอยู่ในกรอบหรือไม่
//  */
// export const isInsideBound = (
//   userLat: number | string, 
//   userLon: number | string, 
//   siteLat: number | string, 
//   siteLon: number | string
// ) => {
//   const uLat = typeof userLat === "string" ? parseFloat(userLat.trim()) : userLat;
//   const uLon = typeof userLon === "string" ? parseFloat(userLon.trim()) : userLon;
//   const sLat = typeof siteLat === "string" ? parseFloat(siteLat.trim()) : siteLat;
//   const sLon = typeof siteLon === "string" ? parseFloat(siteLon.trim()) : siteLon;

//   if (isNaN(uLat) || isNaN(uLon) || isNaN(sLat) || isNaN(sLon)) return false;

//   return (
//     uLat >= sLat - OFFSET_10M &&
//     uLat <= sLat + OFFSET_10M &&
//     uLon >= sLon - OFFSET_10M &&
//     uLon <= sLon + OFFSET_10M
//   );
// };

// /**
//  * 2. ฟังก์ชันหลักสำหรับหา "ไซต์งานผู้ชนะ" (Check-in)
//  * ปรับปรุง: รองรับการเช็คอินนอกเขตโดยใช้ Modal ยืนยัน (คล้าย Check-out)
//  */
// export const validateAndGetSite = async (
//   userLat: number | string,
//   userLon: number | string,
//   companyId: string, 
//   fixedSiteId: string | null
// ) => {
//   let winnerSite: any = null;
//   let isEverySiteUser = false;
//   let isOffsiteIn = "0";
//   let OffsiteCheckInConfirm = false;

//   // --- ขั้นตอนที่ 1: ตรวจสอบสถานะ User ว่าผูกกับ "ทุกไซต์" หรือไม่ ---
//   if (fixedSiteId && fixedSiteId !== "") {
//     const site = await db.query.sitesTable.findFirst({
//       where: eq(sitesTable.id, fixedSiteId),
//     });

//     if (site?.name === "ทุกไซต์") {
//       isEverySiteUser = true;
//     }
//   }

//   // --- ขั้นตอนที่ 2: กวาดหาไซต์จริงจากฐานข้อมูล ---
//   const allActualSites = await db.query.sitesTable.findMany({
//     where: ne(sitesTable.name, "ทุกไซต์")
//   }); 

//   const actualLocationSite = allActualSites.find(site => {
//     if (!site.coordinates) return false;
//     const [sLat, sLon] = site.coordinates.split(',').map(s => s.trim());
//     return isInsideBound(userLat, userLon, sLat, sLon);
//   });

//   // --- ขั้นตอนที่ 3: ตัดสินผู้ชนะตาม Logic ใหม่ (ยอมรับการอยู่นอกเขต) ---
//   if (isEverySiteUser) {
//     if (actualLocationSite) {
//       winnerSite = actualLocationSite;
//       isOffsiteIn = "0";
//       OffsiteCheckInConfirm = false;
//     } else {
//       // กลุ่มทุกไซต์ แต่อยู่ข้างนอก: ให้สิทธิ์เลือกไซต์แรกหรือแจ้งให้ยืนยัน (ในที่นี้ให้ Error เพราะไม่มีไซต์อ้างอิง)
//       // แต่เพื่อให้คล้าย Check-out จะส่งสถานะออกไปเพื่อให้ Client จัดการต่อ
//       isOffsiteIn = "1";
//       OffsiteCheckInConfirm = true;
//       throw new Error("ไม่พบไซต์งานในรัศมีที่กำหนด (สำหรับพนักงานกลุ่มทุกไซต์)");
//     }
//   } else {
//     if (fixedSiteId) {
//       const site = await db.query.sitesTable.findFirst({ where: eq(sitesTable.id, fixedSiteId) });
//       if (site && site.coordinates) {
//         const [sLat, sLon] = site.coordinates.split(',').map(s => s.trim());
//         const isInside = isInsideBound(userLat, userLon, sLat, sLon);
        
//         winnerSite = site;
//         if (!isInside) {
//           // อยู่นอกเขตไซต์ประจำ: ไม่ Throw Error แต่ส่ง flag ไปให้ยืนยันแทน
//           isOffsiteIn = "1";
//           OffsiteCheckInConfirm = true;
//         } else {
//           isOffsiteIn = "0";
//           OffsiteCheckInConfirm = false;
//         }
//       }
//     }
//   }

//   if (!winnerSite) throw new Error("ไม่พบข้อมูลไซต์งานที่ถูกต้อง");

//   // คืนค่า winnerSite พร้อมข้อมูลการอยู่นอกเขต
//   return {
//     ...winnerSite,
//     isOffsiteIn,
//     OffsiteCheckInConfirm,
//     userCoordinates: `${userLat}, ${userLon}`
//   };
// };

// /**
//  * 3. ฟังก์ชันสำหรับ Validate พิกัดตอนเช็คเอาท์ (Check-out)
//  */
// export const validateCheckOutLocation = async (
//   userId: string,
//   userLat: number | string,
//   userLon: number | string,
//   currentRecord: any 
// ) => {
//   const userProfile = await db.query.usersTable.findFirst({
//     where: eq(usersTable.id, userId),
//   });

//   const mainSite = await db.query.sitesTable.findFirst({
//     where: eq(sitesTable.id, userProfile?.site_id || ""),
//   });
  
//   const isEverySiteUser = mainSite?.name === "ทุกไซต์";

//   if (isEverySiteUser) {
//     const allActualSites = await db.query.sitesTable.findMany({
//       where: ne(sitesTable.name, "ทุกไซต์")
//     });

//     const isAtAnySite = allActualSites.some(site => {
//       if (!site.coordinates) return false;
//       const [sLat, sLon] = site.coordinates.split(',').map(s => s.trim());
//       return isInsideBound(userLat, userLon, sLat, sLon);
//     });

//     if (isAtAnySite) {
//       return { 
//         isOffsiteOut: "0", 
//         isOffsiteOutCoordinates: `${userLat}, ${userLon}`, 
//         OffsiteCheckOutConfirm: false,
//       };
//     } else {
//       return { 
//         isOffsiteOut: "1", 
//         isOffsiteOutCoordinates: `${userLat}, ${userLon}`, 
//         OffsiteCheckOutConfirm: true,
//       };
//     }
//   }

//   if (!currentRecord?.site_id) {
//     return { 
//       isOffsiteOut: "1", 
//       isOffsiteOutCoordinates: `${userLat}, ${userLon}`, 
//       OffsiteCheckOutConfirm: true,
//       siteName: currentRecord?.siteInNameSnapshot || "ไม่ระบุไซต์"
//     };
//   }

//   const siteInDb = await db.query.sitesTable.findFirst({
//     where: eq(sitesTable.id, currentRecord.site_id),
//   });

//   if (siteInDb && siteInDb.coordinates) {
//     const [sLat, sLon] = siteInDb.coordinates.split(',').map(s => s.trim());
//     const isInside = isInsideBound(userLat, userLon, sLat, sLon);

//     if (!isInside) {
//       return { 
//         isOffsiteOut: "1", 
//         isOffsiteOutCoordinates: `${userLat}, ${userLon}`, 
//         OffsiteCheckOutConfirm: true,
//         siteName: currentRecord?.siteInNameSnapshot || siteInDb.name 
//       };
//     }

//     return { 
//       isOffsiteOut: "0", 
//       isOffsiteOutCoordinates: `${userLat}, ${userLon}`, 
//       OffsiteCheckOutConfirm: false,
//       siteName: currentRecord?.siteInNameSnapshot || siteInDb.name 
//     };
//   }

//   throw new Error("ไม่พบข้อมูลพิกัดไซต์งานสำหรับการตรวจสอบ");
// };