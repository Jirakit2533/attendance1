import { UTApi } from "uploadthing/server";

// ✅ สร้าง instance โดยใช้ Token จาก .env
export const utapi = new UTApi({
  token: process.env.UPLOADTHING_TOKEN,
});

/**
 * ฟังก์ชันอัปโหลดรูปจาก Buffer (Server-side)
 */
export async function uploadToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string = "image/jpeg"
) {
  try {
    const file = new File([fileBuffer], fileName, { type: mimeType });
    // ปรับส่งเป็น Array เพื่อบังคับให้ SDK คืนค่ากลับมาเป็น Array รูปแบบมาตรฐานที่เสถียรที่สุด
    const response = await utapi.uploadFiles([file]);

    const uploadedFile = Array.isArray(response) ? response[0] : response;
    
    // ตรวจสอบความปลอดภัยของข้อมูลก่อนดึงไปใช้งาน
    if (!uploadedFile) throw new Error("Upload failed: No response received from UploadThing");
    if (uploadedFile.error) throw new Error(uploadedFile.error.message);
    if (!uploadedFile.data) throw new Error("Upload failed: 'data' property is undefined");

    return {
      fileId: uploadedFile.data.key,
      // ดักควบทั้ง ufsUrl และ url เผื่อกรณี Version Mismatch เพื่อป้องกันไม่ให้คืนค่าไปเป็น undefined
      url: uploadedFile.data.ufsUrl || (uploadedFile.data as any).url,
    };
  } catch (error: any) {
    console.error("❌ Uploadthing Error:", error);
    throw error;
  }
}

/**
 * ฟังก์ชันลบรูป
 */
export async function deleteFromDrive(fileId: string) {
  try {
    if (!fileId) return { success: false };
    await utapi.deleteFiles(fileId);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}