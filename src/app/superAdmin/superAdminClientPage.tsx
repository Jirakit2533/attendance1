"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  saveCompanyAction,
  deleteCompanyAction,
  saveAdminAction,
  deleteAdminAction,
  addFeatureToLibraryAction,
} from "./actions";

import { clearSessionAction } from "../login/api/login-action";
import {
  Building2,
  Users,
  ShieldCheck,
  LogOut,
  Plus,
  Search,
  Trash2,
  X,
  Edit3,
  Phone,
} from "lucide-react";

/* ---------- TYPES ---------- */
type Company = {
  id: string;
  name: string;
  code: string;
  status: "active" | "suspended";
  phone: string;
  address: string;
  email: string;
  siteCount: number;
  adminCount: number;
  companyPrefix: string;
  leaderCount: number;
  employeeCount: number;
  createdByName: string | null;
  updateByName: string | null;
  deletedByName: string | null;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

type CompanyAdmin = {
  id: string;
  companyId: string;
  name: string;
  username: string;
  password?: string;
  email: string;
  avatar: string;
  status: "active" | "suspended";
  departmentCount: number;
  siteCount: number;
  positionCount: number;
  adminCount: number;
  leaderCount: number;
  employeeCount: number;
  createdByName: string | null;
  updateByName: string | null;
  deletedByName: string | null;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

interface SuperAdminClientPageProps {
  initialCompanies: Company[];
  initialAdmins: CompanyAdmin[];
  initialSuperAdmin: { id: string; name: string } | null;
  featureLibrary: any[];
  currentSelectedFeatures?: string[];
}

export default function SuperAdminClientPage({
  initialCompanies,
  initialAdmins,
  initialSuperAdmin,
  featureLibrary,
  currentSelectedFeatures,
}: SuperAdminClientPageProps) {
  const router = useRouter();

  /* ---------- DATA STATE ---------- */
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [admins, setAdmins] = useState<CompanyAdmin[]>(initialAdmins);

  // อัปเดต State เมื่อ Props เปลี่ยน (จาก revalidatePath)
  useEffect(() => {
    setCompanies(initialCompanies);
  }, [initialCompanies]);
  useEffect(() => {
    setAdmins(initialAdmins);
  }, [initialAdmins]);

  /* ---------- UI STATE ---------- */
  const [searchComp, setSearchComp] = useState("");
  const [searchAdmin, setSearchAdmin] = useState("");
  const [showCompModal, setShowCompModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingComp, setEditingComp] = useState<Company | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<CompanyAdmin | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [showAddFeatureModal, setShowAddFeatureModal] = useState(false);
  const [addFeature, setAddFeature] = useState<any>(null); // สำหรับเก็บข้อมูลที่จะแก้ไข (ถ้ามี)

  /* ---------- FILTER LOGIC ---------- */
  const filteredCompanies = useMemo(() => {
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(searchComp.toLowerCase()) ||
        c.code.toLowerCase().includes(searchComp.toLowerCase())
    );
  }, [companies, searchComp]);

  const filteredAdmins = useMemo(() => {
    return admins.filter(
      (a) =>
        a.name.toLowerCase().includes(searchAdmin.toLowerCase()) ||
        a.username.toLowerCase().includes(searchAdmin.toLowerCase())
    );
  }, [admins, searchAdmin]);

  /* ---------- HANDLERS ---------- */

  // 🚩 Handler สำหรับบันทึกฟีเจอร์ที่เลือกให้บริษัท
  const handleSaveSelectedFeatures = async (
    e: React.FormEvent<HTMLFormElement>,
    companyId: string
  ) => {
    e.preventDefault();
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    // ดึงค่าจาก checkbox ทั้งหมดที่ชื่อ "selectedFeatures"
    const selectedFeatures = formData.getAll("selectedFeatures") as string[];

    try {
      const result = await saveCompanyFeatureSelectionAction(
        companyId,
        selectedFeatures
      );

      if (result.success) {
        // ปิด Modal และ Refresh ข้อมูล
        setEditingComp(null);
        router.refresh();
      } else {
        alert(result.error || "บันทึกการเลือกฟีเจอร์ไม่สำเร็จ");
      }
    } catch (error) {
      console.error("Save Selection Error:", error);
    } finally {
      setIsPending(false);
    }
  };

  // 🚩 Handler สำหรับบันทึกข้อมูล Feature Library
  const handleSaveFeatureLibrary = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("featureName") as string;
    const description = formData.get("featureDescription") as string;

    try {
      // เรียก Server Action
      const result = await addFeatureToLibraryAction(name, description);

      if (result.success) {
        setShowAddFeatureModal(false);
        setAddFeature(null); // ล้าง State หลังจากบันทึกสำเร็จ
      } else {
        alert(result.error || "ไม่สามารถบันทึกข้อมูลได้");
      }
    } catch (error) {
      console.error("Save Feature Error:", error);
    } finally {
      setIsPending(false);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    const formData = new FormData(e.currentTarget);

    // ดึงรายการฟีเจอร์ที่ถูกเลือกจาก Checkbox (ดึงออกมาเป็น string[])
    const selectedFeatures = formData.getAll("selectedFeatures") as string[];

    // เตรียมข้อมูลบริษัท
    const data = {
      id: editingComp?.id,
      name: formData.get("name") as string,
      companyCode: formData.get("companyCode") as string,
      companyPrefix: formData.get("companyPrefix") as string,
      otRoundingOption: formData.get("otRoundingOption") as string,
      phone: formData.get("phone") as string,
      address: formData.get("address") as string,
      email: formData.get("email") as string,
      // เพิ่มส่วนของ features เข้าไปใน object ที่จะส่งไปยัง action
      selectedFeatures: selectedFeatures, 
    };

    try {
      // เรียกใช้ action เดียวเพื่อบันทึกทั้งข้อมูลบริษัทและการเลือกฟีเจอร์
      const result = await saveCompanyAction(data);
      if (result?.success) {
        setShowCompModal(false);
        setEditingComp(null);
        router.refresh();
      } else {
        alert(
          "❌ บันทึกไม่สำเร็จ: " +
            (result?.error || "รหัสบริษัทนี้อาจถูกใช้ไปแล้ว")
        );
      }
    } catch (error) {
      console.error("Client Save Error:", error);
    } finally {
      setIsPending(false);
    }
  };

  const handleSaveAdmin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      id: editingAdmin?.id,
      companyId: formData.get("companyId") as string,
      name: formData.get("name") as string,
      username: formData.get("username") as string,
      email: formData.get("email") as string,
      password: (formData.get("password") as string) || undefined,
      isEdit: !!editingAdmin,
    };
    try {
      const result = await saveAdminAction(data);
      if (result.success) {
        setShowAdminModal(false);
        setEditingAdmin(null);
        router.refresh();
      } else {
        alert("เกิดข้อผิดพลาด: " + result.error);
      }
    } catch (error) {
      console.error("Admin Save Error:", error);
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async (
    id: string,
    name: string,
    type: "comp" | "admin"
  ) => {
    if (
      !window.confirm(
        `คุณแน่ใจหรือไม่ที่จะลบ ${type === "comp" ? "บริษัท" : "แอดมิน"}: "${name}"?`
      )
    )
      return;
    setIsDeleting(id);
    try {
      const result =
        type === "comp"
          ? await deleteCompanyAction(id)
          : await deleteAdminAction(id);
      if (result.success) {
        router.refresh();
      } else {
        alert(`❌ ไม่สามารถลบได้: ${result.error}`);
      }
    } catch (error) {
      alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleLogout = async () => {
    if (!confirm("ยืนยันการออกจากระบบ?")) return;

    try {
      const result = await clearSessionAction();

      if (result.success) {
        const clientCookies = [
          "session_user_id",
          "user_role",
          "role",
          "session",
        ];
        clientCookies.forEach((name) => {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        });

        window.location.replace("/login");
      }
    } catch (error) {
      console.error("Logout failed:", error);
      window.location.replace("/login");
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 font-sans pb-10">
      {/* 🧭 NAV/HEADER */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200">
              <ShieldCheck className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800 uppercase">
                Provider Dashboard
              </h1>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em]">
                Siam Royal Systems
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-xs font-black text-slate-800">
                {initialSuperAdmin?.name || "Super Admin"}
              </p>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                Master Root
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 px-4 py-2 rounded-xl transition-all font-bold text-sm"
            >
              <LogOut size={18} /> ออกจากระบบ
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-8 space-y-10">
        <div className="space-y-2">
          <h2 className="text-4xl font-black tracking-tighter">
            Manage Tenants
          </h2>
          <p className="text-slate-500 font-medium">
            จัดการพาร์ทเนอร์และสิทธิ์ระดับ HR Admin ทั้งหมดในระบบ
          </p>
        </div>
        <button
          onClick={() => {
            setAddFeature(null);
            setShowAddFeatureModal(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95 shrink-0 text-sm"
        >
          <Plus size={18} /> เพิ่มฟีเจอร์ใหม่
        </button>

        {/* 🏢 COMPANY TABLE SECTION */}
        <section className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-white overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-gray-200/30 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-xl font-black flex items-center gap-3 shrink-0">
              <Building2 className="text-indigo-600" /> รายชื่อบริษัทพาร์ทเนอร์
              <span className="ml-2 text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-1 rounded-md">
                {companies.length}
              </span>
            </h3>
            <div className="flex w-full md:w-auto gap-3">
              <div className="relative flex-1 md:w-80">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ หรือ รหัสบริษัท..."
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  value={searchComp}
                  onChange={(e) => setSearchComp(e.target.value)}
                />
              </div>
              <button
                onClick={() => {
                  setEditingComp(null);
                  setShowCompModal(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95 shrink-0 text-sm"
              >
                <Plus size={18} /> ลงทะเบียนบริษัท
              </button>
            </div>
          </div>

          {/* 🏙️ COMPANY TABLE */}
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 shadow-sm text-[11px] uppercase font-black text-slate-400 tracking-widest">
                <tr>
                  <th className="px-8 py-5">ข้อมูลบริษัท</th>
                  <th className="px-8 py-5">การติดต่อ & ที่อยู่</th>
                  <th className="px-8 py-5 text-center">
                    จำนวน Admin / Leader / Employee
                  </th>
                  <th className="px-8 py-5">SuperAdmin จัดการล่าสุด</th>
                  <th className="px-8 py-5 text-center">สถานะ</th>
                  <th className="px-8 py-5 text-center">การทำ OT</th>
                  <th className="px-8 py-5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-bold">
                {filteredCompanies.map((c) => (
                  <tr
                    key={c.id}
                    className="group hover:bg-indigo-50/30 transition-all"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-xs font-black text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all overflow-hidden p-1 text-center leading-tight">
                          {c.code}
                        </div>
                        <div>
                          <p className="text-lg text-slate-800 leading-tight">
                            {c.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-wider">
                            ลงทะเบียนเมื่อ:{" "}
                            {new Date(c.createdAt).toLocaleDateString("th-TH")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm text-slate-600 space-y-1.5">
                      <div className="flex items-center gap-2 font-medium">
                        <Phone size={14} className="text-indigo-400" />{" "}
                        {c.phone}
                      </div>
                      <div className="flex items-start gap-2 text-[12px] text-slate-400 leading-snug max-w-[200px]">
                        <span className="shrink-0 mt-1">📍</span> {c.address}
                      </div>
                      <div className="flex items-start gap-2 text-[12px] text-slate-400 leading-snug max-w-[200px]">
                        <span className="shrink-0 mt-1">📧</span> {c.email}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex justify-center gap-2 text-[10px]">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg w-fit">
                          {c.adminCount} แอดมิน
                        </span>
                        <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-lg w-fit">
                          {c.leaderCount} หัวหน้า
                        </span>
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg w-fit">
                          {c.employeeCount} พนักงาน
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                          <ShieldCheck size={16} className="text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-700">
                            {c.updateByName || c.createdByName || "System"}
                          </p>
                          <p className="text-[10px] text-slate-400 font-normal italic">
                            {c.updateByName ? "Updated" : "Created"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-lg">
                        {{
                          ACTUAL: "นับทุกนาที",
                          EVERY_30_MINS: "นับทุก 30 นาที",
                          EVERY_1_HOUR: "นับทุกชั่วโมง",
                        }[c.otRoundingOption as keyof typeof c] || "ไม่ระบุ"}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-end gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingComp(c);
                            setShowCompModal(true);
                          }}
                          className="p-3 bg-white text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm border border-slate-100 transition-all active:scale-90"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.name, "comp")}
                          disabled={isDeleting === c.id}
                          className="p-3 bg-white text-slate-400 hover:text-red-600 rounded-xl shadow-sm border border-slate-100 transition-all active:scale-90 disabled:opacity-50"
                        >
                          {isDeleting === c.id ? (
                            <div className="w-4 h-4 border-2 border-red-600/20 border-t-red-600 rounded-full animate-spin" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 🔑 ADMIN TABLE SECTION */}
        <section className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-white overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-gray-200/30 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-xl font-black flex items-center gap-3 shrink-0">
              <Users className="text-purple-600" /> รายชื่อ HR Admin
              <span className="ml-2 text-xs font-bold bg-purple-100 text-purple-600 px-2 py-1 rounded-md">
                {admins.length}
              </span>
            </h3>
            <div className="flex w-full md:w-auto gap-3">
              <div className="relative flex-1 md:w-80">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ หรือ Username..."
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none font-bold"
                  value={searchAdmin}
                  onChange={(e) => setSearchAdmin(e.target.value)}
                />
              </div>
              <button
                onClick={() => {
                  setEditingAdmin(null);
                  setShowAdminModal(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-purple-100 flex items-center gap-2 transition-all active:scale-95 shrink-0 text-sm"
              >
                <Plus size={18} /> สร้างบัญชีแอดมิน
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 shadow-sm text-[11px] uppercase font-black text-slate-400 tracking-widest">
                <tr>
                  <th className="px-8 py-5">โปรไฟล์แอดมิน</th>
                  <th className="px-8 py-5">สังกัดบริษัท</th>
                  <th className="px-8 py-5">การติดต่อ</th>
                  <th className="px-8 py-5 text-center">
                    แผนก / ไซต์ / ตำแหน่ง
                  </th>
                  <th className="px-8 py-5 text-center">Leader / Employee</th>
                  <th className="px-8 py-5 text-center">จัดการล่าสุดโดย</th>
                  <th className="px-8 py-5 text-center">สถานะ</th>
                  <th className="px-8 py-5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-bold">
                {filteredAdmins.map((a) => (
                  <tr
                    key={a.id}
                    className="group hover:bg-purple-50/30 transition-all"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 font-black">
                          {a.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-slate-800">{a.name}</p>
                          <p className="text-xs text-purple-500 font-mono">
                            @{a.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-slate-700 text-sm">
                          {companies.find((c) => c.id === a.companyId)?.name ||
                            "Unknown"}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-tighter">
                          Tenant ID: {a.companyId.slice(0, 8)}...
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm text-slate-600">
                      <div className="flex items-start gap-2 text-[12px] text-slate-400 leading-snug">
                        <span className="shrink-0 mt-0.5">📧</span> {a.email}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex justify-center gap-2 text-[10px]">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                          {a.departmentCount} แผนก
                        </span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                          {a.siteCount} ไซต์
                        </span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                          {a.positionCount} ตำแหน่ง
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex justify-center gap-2 text-[10px]">
                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-md">
                          {a.leaderCount} หัวหน้า
                        </span>
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">
                          {a.employeeCount} พนักงาน
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                          <ShieldCheck size={16} className="text-slate-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm text-slate-700">
                            {a.updateByName || a.createdByName || "System"}
                          </p>
                          <p className="text-[10px] text-slate-400 font-normal italic">
                            {a.updateByName ? "Updated" : "Created"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-end gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingAdmin(a);
                            setShowAdminModal(true);
                          }}
                          className="p-3 bg-white text-slate-400 hover:text-purple-600 rounded-xl shadow-sm border border-slate-100 transition-all"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(a.id, a.name, "admin")}
                          disabled={isDeleting === a.id}
                          className="p-3 bg-white text-slate-400 hover:text-red-600 rounded-xl shadow-sm border border-slate-100 transition-all active:scale-90 disabled:opacity-50"
                        >
                          {isDeleting === a.id ? (
                            <div className="w-4 h-4 border-2 border-red-600/20 border-t-red-600 rounded-full animate-spin" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {showAddFeatureModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h4 className="text-xl font-black flex items-center gap-2 text-slate-800">
                <Plus className="text-indigo-600" />
                {addFeature ? "แก้ไขฟีเจอร์" : "เพิ่มฟีเจอร์เข้าระบบ"}
              </h4>
              <button
                onClick={() => {
                  setShowAddFeatureModal(false);
                  setAddFeature(null);
                }}
                className="p-2 hover:bg-white rounded-full transition-colors text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveFeatureLibrary} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">
                  ชื่อฟังก์ชัน
                </label>
                <input
                  name="featureName"
                  defaultValue={addFeature?.name || ""}
                  required
                  placeholder="เช่น remarkAttendance"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">
                  รายละเอียด
                </label>
                <textarea
                  name="featureDescription"
                  defaultValue={addFeature?.description || ""}
                  rows={3}
                  placeholder="อธิบายการทำงาน..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddFeatureModal(false);
                    setAddFeature(null);
                  }}
                  className="w-full bg-slate-100 text-slate-600 py-4 rounded-xl font-black hover:bg-slate-200 transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  disabled={isPending}
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:bg-slate-300 flex items-center justify-center gap-2"
                >
                  {isPending && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {isPending ? "กำลังบันทึก..." : "ยืนยันการเพิ่ม"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🏙️ COMPANY MODAL */}
      {showCompModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h4 className="text-xl font-black flex items-center gap-2">
                {editingComp ? (
                  <Edit3 className="text-indigo-600" />
                ) : (
                  <Plus className="text-indigo-600" />
                )}
                {editingComp ? "แก้ไขข้อมูลบริษัท" : "ลงทะเบียนบริษัทใหม่"}
              </h4>
              <button
                onClick={() => {
                  setShowCompModal(false);
                  setEditingComp(null);
                }}
                className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSaveCompany}
              className="p-8 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar"
            >
              {/* --- ส่วนที่ส่งข้อมูล ID และ Code ป้องกันค่าหลุด --- */}
              {editingComp && (
                <input type="hidden" name="id" value={editingComp.id} />
              )}
              {editingComp && (
                <input
                  type="hidden"
                  name="companyCode"
                  value={editingComp.companyCode || editingComp.code}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    รหัสบริษัท (Code)
                  </label>
                  <input
                    name="companyCode"
                    defaultValue={editingComp?.companyCode || editingComp?.code}
                    placeholder="เช่น TSF"
                    className={`w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold transition-all ${
                      editingComp
                        ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                        : "focus:ring-2 focus:ring-indigo-500 bg-white"
                    }`}
                    required
                    readOnly={!!editingComp}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    คำนำหน้าบริษัท (Prefix)
                  </label>
                  <input
                    name="companyPrefix"
                    defaultValue={editingComp?.companyPrefix}
                    placeholder="เช่น TSF"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    ชื่อบริษัท
                  </label>
                  <input
                    name="name"
                    defaultValue={editingComp?.name}
                    placeholder="บริษัท..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    การปัดเศษ OT
                  </label>
                  <select
                    name="otRoundingOption"
                    defaultValue={editingComp?.otRoundingOption || "ACTUAL"}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white appearance-none cursor-pointer"
                    required
                  >
                    <option value="ACTUAL">ตามจริง (Actual)</option>
                    <option value="EVERY_30_MINS">ทุกๆ 30 นาที</option>
                    <option value="EVERY_1_HOUR">ทุกๆ 1 ชั่วโมง</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    อีเมลติดต่อ
                  </label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={editingComp?.email}
                    placeholder="hr@company.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    name="phone"
                    defaultValue={editingComp?.phone}
                    placeholder="02-xxx-xxxx"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">
                  ที่อยู่สำนักงาน
                </label>
                <textarea
                  name="address"
                  defaultValue={editingComp?.address}
                  rows={2}
                  placeholder="เลขที่อาคาร ถนน แขวง/ตำบล..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm bg-white"
                />
              </div>

              {/* --- ส่วนที่เพิ่มใหม่: Feature Configuration (JSONB) --- */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-indigo-500">
                    ระดับการบริการ (Drop Down)
                  </label>
                  <select
                    name="serviceLevel"
                    defaultValue={editingComp?.serviceLevel || "BASIC"}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white appearance-none cursor-pointer"
                  >
                    <option value="BASIC">Basic Plan</option>
                    <option value="PREMIUM">Premium Plan</option>
                    <option value="ENTERPRISE">Enterprise Plan</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-indigo-500">
                    ฟีเจอร์ที่เปิดใช้งาน (Check Box List)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {/* ข้อมูลวนลูปมาจาก featureLibraryTable */}
                    {featureLibrary?.map((feature) => (
                      <label
                        key={feature.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors border border-slate-100 has-[:checked]:border-indigo-200 has-[:checked]:bg-indigo-50/30"
                      >
                        <input
                          type="checkbox"
                          name="selectedFeatures"
                          value={feature.name}
                          className="w-4 h-4 accent-indigo-600 rounded"
                          defaultChecked={
                            editingComp?.currentSelectedFeatures?.includes(feature.name) || 
                            currentSelectedFeatures?.includes(feature.name)
                          }
                        />
                        <span className="text-xs font-bold text-slate-600">
                          {feature.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <button
                disabled={isPending}
                type="submit"
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all mt-4 disabled:bg-slate-300 flex items-center justify-center gap-2"
              >
                {isPending && (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {isPending
                  ? "กำลังดำเนินการ..."
                  : editingComp
                    ? "อัปเดตข้อมูลบริษัท"
                    : "ยืนยันการลงทะเบียน"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 👤 ADMIN MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h4 className="text-xl font-black flex items-center gap-2">
                {editingAdmin ? (
                  <Edit3 className="text-purple-600" />
                ) : (
                  <Plus className="text-purple-600" />
                )}
                {editingAdmin ? "แก้ไขแอดมิน" : "สร้างบัญชีแอดมิน"}
              </h4>
              <button
                onClick={() => {
                  setShowAdminModal(false);
                  setEditingAdmin(null);
                }}
                className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAdmin} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">
                  สังกัดบริษัท
                </label>
                <select
                  name="companyId"
                  defaultValue={editingAdmin?.companyId}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold appearance-none bg-white cursor-pointer"
                  required
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">
                  ชื่อ-นามสกุล
                </label>
                <input
                  name="name"
                  defaultValue={editingAdmin?.name}
                  placeholder="ชื่อแอดมิน..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold bg-white"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    Username
                  </label>
                  <input
                    name="username"
                    defaultValue={editingAdmin?.username}
                    placeholder="Username..."
                    readOnly={!!editingAdmin}
                    className={`w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold font-mono transition-all ${
                      editingAdmin
                        ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                        : "focus:ring-2 focus:ring-purple-500 bg-white"
                    }`}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    Password
                  </label>
                  <input
                    name="password"
                    type="password"
                    placeholder={
                      editingAdmin ? "เปลี่ยนรหัสผ่าน" : "รหัสผ่าน..."
                    }
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold bg-white"
                    required={!editingAdmin}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">
                  อีเมลแอดมิน
                </label>
                <input
                  name="email"
                  type="email"
                  defaultValue={editingAdmin?.email}
                  placeholder="admin@company.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold bg-white"
                />
              </div>
              <button
                disabled={isPending}
                type="submit"
                className="w-full bg-purple-600 text-white py-4 rounded-xl font-black shadow-lg shadow-purple-100 hover:bg-purple-700 transition-all mt-4 disabled:bg-slate-300 flex items-center justify-center gap-2"
              >
                {isPending && (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {isPending ? "กำลังบันทึก..." : "ยืนยันข้อมูลแอดมิน"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
        isActive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
      />
      {isActive ? "ACTIVE" : "SUSPENDED"}
    </span>
  );
}
