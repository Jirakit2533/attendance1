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
    const response = await utapi.uploadFiles(file);

    const uploadedFile = Array.isArray(response) ? response[0] : response;
    if (uploadedFile.error) throw new Error(uploadedFile.error.message);

    return {
      fileId: uploadedFile.data.key,
      url: uploadedFile.data.ufsUrl,
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