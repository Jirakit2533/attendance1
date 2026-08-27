import { UTApi } from "uploadthing/server";

export const utapi = new UTApi({
  token: process.env.UPLOADTHING_TOKEN,
});

/**
 * ฟังก์ชันอัปโหลดรูปจาก Buffer (Server-side)
 *
 * Contract:
 * - สำเร็จ  -> ต้องได้ fileId + url
 * - ล้มเหลว -> throw Error
 */
export async function uploadToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string = "image/jpeg"
) {
  try {
    const file = new File([fileBuffer], fileName, {
      type: mimeType,
    });

    const response = await utapi.uploadFiles([file]);

    const uploadedFile = Array.isArray(response)
      ? response[0]
      : response;

    if (!uploadedFile) {
      throw new Error(
        "Upload failed: No response received from UploadThing"
      );
    }

    if (uploadedFile.error) {
      throw new Error(uploadedFile.error.message);
    }

    if (!uploadedFile.data) {
      throw new Error(
        "Upload failed: 'data' property is undefined"
      );
    }

    const fileId = uploadedFile.data.key;

    const url =
      uploadedFile.data.ufsUrl ||
      (uploadedFile.data as any).url;

    // สำคัญมาก:
    // ห้ามปล่อย upload สำเร็จแต่ URL ว่างออกไป
    if (!fileId) {
      throw new Error(
        "Upload failed: UploadThing returned no file key"
      );
    }

    if (!url) {
      console.error(
        "❌ UploadThing returned no URL:",
        uploadedFile.data
      );

      throw new Error(
        "Upload failed: UploadThing returned no URL"
      );
    }

    console.log("✅ UploadThing success:", {
      fileId,
      url,
    });

    return {
      fileId,
      url,
    };
  } catch (error: any) {
    console.error("❌ UploadThing Error:", error);
    throw error;
  }
}

/**
 * ฟังก์ชันลบรูป
 */
export async function deleteFromDrive(fileId: string) {
  try {
    if (!fileId) {
      return { success: false };
    }

    await utapi.deleteFiles(fileId);

    return {
      success: true,
    };
  } catch (error) {
    console.error("❌ Delete UploadThing Error:", error);

    return {
      success: false,
    };
  }
}