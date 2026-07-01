import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// 1. กำหนดชนิดของข้อมูล (Props) ที่จะรับเข้ามา
interface CardSmallProps {
  title: string;
  description?: string;
  onClose: () => void;
}

// 2. รับค่า title, description และ onClose เข้ามาใช้งาน
export function CardSmall({ title, description, onClose }: CardSmallProps) {
  return (
    <Card size="sm" className="mx-auto w-full max-w-sm shadow-xl border-blue-100">

      {/* ส่วนหัวการ์ด แสดงข้อความเข้างาน/เลิกงานสำเร็จ */}
      <CardHeader className="text-center pb-2">
        <div className="mx-auto bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <CardTitle className="text-xl text-blue-700">{title}</CardTitle>

        {/* แสดง description ถ้ามีการส่งค่ามา */}
        {description && (
          <CardDescription className="text-gray-500 mt-2">
            {description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent>
        {/* ลบข้อความภาษาอังกฤษเดิมออก เพื่อความสะอาดตา */}
      </CardContent>

      <CardFooter>
        {/* 3. ผูกฟังก์ชัน onClose เข้ากับปุ่มตกลง เมื่อกดแล้วการ์ดจะปิด */}
        <Button 
          variant="default" 
          size="sm" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
          onClick={onClose}
        >
          ตกลง
        </Button>
      </CardFooter>

    </Card>
  )
}