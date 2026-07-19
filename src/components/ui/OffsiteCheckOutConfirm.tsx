import React, { useState } from 'react';

// ตัวแปร Component สำหรับแสดงผล Pop-up ยืนยัน (ปรับปรุงให้รองรับ Mobile-First)
export const OffsiteCheckOutConfirm = ({ onConfirm, onCancel, siteName }: { onConfirm: () => void, onCancel: () => void, siteName: string }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Container: ปรับเป็น Slide up บนมือถือ และ Center บนจอคอม */}
      <div className="w-full max-w-md p-6 bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-amber-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="text-center">
          {/* แถบสำหรับลากบนมือถือ (Visual Only) */}
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden" />
          
          <div className="flex justify-center mb-4 text-amber-500">
            {/* Icon Alert */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 sm:w-16 sm:h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h3 className="mb-2 text-xl font-bold text-gray-900">แจ้งเตือนพิกัดไม่ตรง</h3>
          
          <div className="space-y-2">
            <p className="text-gray-600 leading-relaxed">
              คุณไม่ได้อยู่ในรัศมีของไซต์งาน <br className="sm:hidden" />
              <span className="font-semibold text-blue-600">"{siteName}"</span> 
            </p>
            <p className="text-[15px] font-medium text-amber-600 bg-amber-50 py-2 px-3 rounded-lg">
              ยืนยันที่จะลงชื่อออกแบบพิกัดไม่ตรงหรือไม่?
            </p>
          </div>
        </div>

        {/* Buttons: ปรับขนาดให้กดง่ายบนมือถือ (Touch Target) */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8">
          <button
            onClick={onCancel}
            className="w-full sm:flex-1 px-4 py-4 sm:py-3 font-semibold text-gray-700 bg-gray-100 rounded-xl sm:rounded-lg hover:bg-gray-200 transition-colors active:scale-95"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            className="w-full sm:flex-1 px-4 py-4 sm:py-3 font-semibold text-white bg-amber-500 rounded-xl sm:rounded-lg hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 active:scale-95"
          >
            ยืนยันลงชื่อออก
          </button>
        </div>
      </div>
    </div>
  );
};

// --- ตัวอย่างการนำไปใช้ในหน้าหลัก (Employee Page) ---
export const CheckOutPage = ({ userId, departmentId, siteId }: any) => {
  const [showPopup, setShowPopup] = useState(false);
  const [pendingData, setPendingData] = useState<any>(null);

  const handleCheckOut = async (isConfirmed = false) => {
    // สมมติว่าดึงพิกัดและรูปภาพมาแล้ว
    const userLocation = "13.7563, 100.5018"; 
    const base64Image = "..."; 

    const payload = {
      userId: userId,
      type: "OUT" as const,
      image: base64Image,
      location: userLocation,
      departmentId: departmentId,
      siteId: siteId,
      isConfirmed: isConfirmed 
    };

    const result = await saveAttendanceAction(payload); 

    if (result.success) {
      if (result.OffsiteCheckOutConfirm) {
        setPendingData({ ...payload, siteName: result.siteName });
        setShowPopup(true);
      } else {
        alert("ลงชื่อออกสำเร็จ!");
        setShowPopup(false);
      }
    } else {
      alert(result.error);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen flex flex-col justify-end pb-10 sm:justify-start sm:pt-10">
      {/* ปุ่มกดเช็คเอาท์: ดีไซน์ให้เหมาะกับนิ้วโป้ง (Thumb Zone) บนมือถือ */}
      <button 
        onClick={() => handleCheckOut(false)}
        className="w-full py-5 text-white bg-gradient-to-r from-red-600 to-red-500 rounded-2xl font-bold text-xl shadow-xl shadow-red-200 active:scale-[0.98] transition-all"
      >
        กดเช็คเอาท์ (Check Out)
      </button>

      {showPopup && (
        <OffsiteCheckOutConfirm 
          siteName={pendingData?.siteName || "ไซต์งานเดิม"} 
          onCancel={() => setShowPopup(false)}
          onConfirm={() => {
            handleCheckOut(true);
          }}
        />
      )}
    </div>
  );
};