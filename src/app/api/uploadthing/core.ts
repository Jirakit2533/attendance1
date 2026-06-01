import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

// FileRouter สำหรับแอปพลิเคชันของคุณ
export const ourFileRouter = {
  // 1. สำหรับบันทึกเวลา (Check-in / Check-out) - รองรับเฉพาะรูปภาพ
  imageUploader: f({ 
    image: { maxFileSize: "4MB", maxFileCount: 1 } 
  })
    .middleware(async () => {
      // คุณสามารถเพิ่มการเช็ค Session ที่นี่ได้ในอนาคต
      return { uploadedAt: new Date().toISOString() };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Attendance Image Uploaded:", file.ufsUrl);
      // ค่าที่ return ตรงนี้จะถูกส่งกลับไปให้ useUploadThing ในฝั่ง Client
      return { uploadedBy: "system", url: file.ufsUrl, key: file.key };
    }),

  // 2. สำหรับการส่งใบลา - รองรับทั้งรูปภาพ และ PDF
  leaveFileUploader: f({ 
    image: { maxFileSize: "4MB", maxFileCount: 1 },
    pdf: { maxFileSize: "4MB", maxFileCount: 1 } 
  })
    .middleware(async () => {
      return { uploadedAt: new Date().toISOString() };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Leave Request File Uploaded:", file.ufsUrl);
      // สำคัญ: ต้องคืนค่า url และ key เพื่อให้ LeaderPage นำไปบันทึกลงฐานข้อมูลต่อได้
      return { url: file.ufsUrl, key: file.key };
    }),
    
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;