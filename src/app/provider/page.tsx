"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

/* ================== TYPES ================== */

// บริษัทลูกค้า (Tenant)
type Company = {
  id: string;
  name: string;
  code: string;
  status: "active" | "suspended";
  createdAt: string;
};

// Admin ของบริษัทลูกค้า
type CompanyAdmin = {
  id: string;
  companyId: string;
  name: string;
  username: string;
  email?: string;
  status: "active" | "suspended";
  createdAt: string;
};

/* ================== PAGE ================== */

export default function ProviderPage() {
  const router = useRouter();

  /* ---------- PROVIDER INFO ---------- */
  const provider = {
    name: "นายสมพงษ์ ร่ำรวย",
    role: "System Provider",
    company: "Siam Royal System Co., Ltd.",
    avatar: "/profile.png",
  };

  /* ---------- STATE ---------- */

  const [companies, setCompanies] = useState<Company[]>([
    {
      id: "COMP-001",
      name: "Thai Smart Factory",
      code: "TSF",
      status: "active",
      createdAt: new Date().toISOString(),
    },
  ]);

  const [admins, setAdmins] = useState<CompanyAdmin[]>([
    {
      id: "ADM-001",
      companyId: "COMP-001",
      name: "สมชาย ร่ำรวย",
      username: "tsf_admin",
      email: "admin@tsf.co.th",
      status: "active",
      createdAt: new Date().toISOString(),
    },
  ]);

  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);

  /* ---------- LOGOUT ---------- */
  const handleLogout = () => {
    router.push("/login");
  };

  /* ---------- COMPANY ACTIONS ---------- */

  const handleAddCompany = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);

    setCompanies(prev => [
      ...prev,
      {
        id: `COMP-${String(prev.length + 1).padStart(3, "0")}`,
        name: String(f.get("name")),
        code: String(f.get("code")),
        status: "active",
        createdAt: new Date().toISOString(),
      },
    ]);

    setShowCompanyForm(false);
  };

  const toggleCompanyStatus = (id: string) => {
    setCompanies(prev =>
      prev.map(c =>
        c.id === id
          ? { ...c, status: c.status === "active" ? "suspended" : "active" }
          : c
      )
    );
  };

  /* ---------- ADMIN ACTIONS ---------- */

  const handleAddAdmin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);

    setAdmins(prev => [
      ...prev,
      {
        id: `ADM-${String(prev.length + 1).padStart(3, "0")}`,
        companyId: String(f.get("companyId")),
        name: String(f.get("name")),
        username: String(f.get("username")),
        email: String(f.get("email")) || undefined,
        status: "active",
        createdAt: new Date().toISOString(),
      },
    ]);

    setShowAdminForm(false);
  };

  const toggleAdminStatus = (id: string) => {
    setAdmins(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, status: a.status === "active" ? "suspended" : "active" }
          : a
      )
    );
  };

  /* ================== UI ================== */

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 space-y-6">

      {/* PROVIDER INFO */}
      <div className="bg-white rounded-xl shadow p-5 flex flex-col sm:flex-row gap-4 items-center">
        <Image src={provider.avatar} alt="" width={96} height={96} className="rounded-full border-4 border-blue-600" />
        <div className="flex-1">
          <h1 className="text-xl font-bold">{provider.name}</h1>
          <p className="text-gray-600">{provider.role}</p>
          <p className="text-gray-500 text-sm">{provider.company}</p>
        </div>
        <button onClick={handleLogout} className="bg-gray-800 text-white px-4 py-2 rounded-xl">
          ลงชื่อออก
        </button>
      </div>

      {/* DASHBOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat title="บริษัททั้งหมด" value={companies.length} />
        <Stat title="Admin ทั้งหมด" value={admins.length} />
        <Stat title="บริษัทที่ใช้งานอยู่" value={companies.filter(c => c.status === "active").length} />
      </div>

      {/* COMPANY SECTION */}
      <Section title="บริษัทลูกค้า (Tenants)">
        <button onClick={() => setShowCompanyForm(true)} className="mb-3 bg-blue-600 text-white px-4 py-2 rounded">
          + เพิ่มบริษัท
        </button>

        <table className="w-full text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2">รหัส</th>
              <th className="p-2">ชื่อบริษัท</th>
              <th className="p-2">สถานะ</th>
              <th className="p-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id} className="border-t">
                <td className="p-2">{c.code}</td>
                <td className="p-2">{c.name}</td>
                <td className="p-2">{c.status}</td>
                <td className="p-2">
                  <button
                    onClick={() => toggleCompanyStatus(c.id)}
                    className="text-blue-600 text-sm"
                  >
                    {c.status === "active" ? "ระงับ" : "เปิดใช้งาน"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ADMIN SECTION */}
      <Section title="Admin ของบริษัทลูกค้า">
        <button onClick={() => setShowAdminForm(true)} className="mb-3 bg-green-600 text-white px-4 py-2 rounded">
          + เพิ่ม Admin
        </button>

        <table className="w-full text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2">ชื่อ</th>
              <th className="p-2">Username</th>
              <th className="p-2">บริษัท</th>
              <th className="p-2">สถานะ</th>
              <th className="p-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {admins.map(a => (
              <tr key={a.id} className="border-t">
                <td className="p-2">{a.name}</td>
                <td className="p-2">{a.username}</td>
                <td className="p-2">
                  {companies.find(c => c.id === a.companyId)?.name}
                </td>
                <td className="p-2">{a.status}</td>
                <td className="p-2">
                  <button
                    onClick={() => toggleAdminStatus(a.id)}
                    className="text-red-600 text-sm"
                  >
                    {a.status === "active" ? "Suspend" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* MODALS */}
      {showCompanyForm && (
        <Modal title="เพิ่มบริษัท" onClose={() => setShowCompanyForm(false)}>
          <form onSubmit={handleAddCompany} className="space-y-3">
            <input name="name" placeholder="ชื่อบริษัท" required className="border p-2 rounded w-full" />
            <input name="code" placeholder="รหัสบริษัท" required className="border p-2 rounded w-full" />
            <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">บันทึก</button>
          </form>
        </Modal>
      )}

      {showAdminForm && (
        <Modal title="เพิ่ม Admin" onClose={() => setShowAdminForm(false)}>
          <form onSubmit={handleAddAdmin} className="space-y-3">
            <input name="name" placeholder="ชื่อ-นามสกุล" required className="border p-2 rounded w-full" />
            <input name="username" placeholder="Username (ใช้เข้าสู่ระบบ)" required className="border p-2 rounded w-full" />
            <input name="email" placeholder="อีเมล (ไม่บังคับ)" className="border p-2 rounded w-full" />
            <select name="companyId" required className="border p-2 rounded w-full">
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button className="bg-green-600 text-white px-4 py-2 rounded w-full">บันทึก</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ================== UI HELPERS ================== */

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <p className="text-gray-500 text-sm">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-5 rounded-xl shadow">
      <h2 className="text-lg font-bold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-5 rounded-xl w-full max-w-md space-y-4">
        <h3 className="font-bold text-lg">{title}</h3>
        {children}
        <button onClick={onClose} className="text-gray-500 text-sm w-full">
          ยกเลิก
        </button>
      </div>
    </div>
  );
}