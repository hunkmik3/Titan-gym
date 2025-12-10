"use client";

import useSWR from "swr";
import { useMemo, useRef, useState } from "react";

type MemberStatus = "active" | "inactive" | "overdue";

type Member = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  plan: string;
  nextPayment: string; // ISO string from backend
  status: MemberStatus;
  checkinsThisMonth: number;
  avatarUrl?: string | null;
  notes?: string | null;
};

const statusStyle: Record<MemberStatus, { label: string; className: string }> =
  {
    active: {
      label: "Đang hoạt động",
      className:
        "bg-green-50 text-green-600 ring-1 ring-inset ring-green-200",
    },
    overdue: {
      label: "Cần gia hạn",
      className: "bg-red-50 text-red-600 ring-1 ring-inset ring-red-200",
    },
    inactive: {
      label: "Tạm dừng",
      className: "bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200",
    },
  };

const plans = [
  "12 tháng - Premium",
  "6 tháng - Standard",
  "3 tháng - Basic",
  "1 tháng - Flex",
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const formatDateDisplay = (dateStr?: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("vi-VN");
};

const getNextPaymentDate = (plan: string) => {
  const now = new Date();
  const lower = plan.toLowerCase();
  let months = 1;
  if (lower.includes("12 tháng")) months = 12;
  else if (lower.includes("6 tháng")) months = 6;
  else if (lower.includes("3 tháng")) months = 3;
  else if (lower.includes("1 tháng")) months = 1;

  const next = new Date(now);
  next.setMonth(next.getMonth() + months);
  return next.toISOString();
};

const getDaysRemaining = (dateStr?: string) => {
  if (!dateStr) return "";
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return "";
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getDaysRemainingInfo = (dateStr?: string) => {
  const days = getDaysRemaining(dateStr);
  const label = days === "" ? "" : `${days} ngày`;
  const overdue = typeof days === "number" && days < 0;
  return { days, label, overdue };
};

export default function Home() {
  const { data: members = [], isLoading, mutate } = useSWR<Member[]>(
    "/api/members",
    fetcher
  );

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "all">("all");
  const [isModalOpen, setModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Member, "id">>({
    name: "",
    phone: "",
    email: "",
    plan: plans[0],
    nextPayment: getNextPaymentDate(plans[0]),
    status: "active",
    checkinsThisMonth: 0,
    avatarUrl: null,
    notes: "",
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchQuery =
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.phone.toLowerCase().includes(query.toLowerCase()) ||
        (m.email ?? "").toLowerCase().includes(query.toLowerCase());
      const matchStatus =
        statusFilter === "all" ? true : m.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [members, query, statusFilter]);

  const activeCount = members.filter((m) => m.status === "active").length;
  const overdueCount = members.filter((m) => m.status === "overdue").length;
  const monthlyCheckins = members.reduce(
    (total, m) => total + m.checkinsThisMonth,
    0
  );

  const resetForm = () => {
    setForm({
      name: "",
      phone: "",
      email: "",
      plan: plans[0],
      nextPayment: getNextPaymentDate(plans[0]),
      status: "active",
      checkinsThisMonth: 0,
      avatarUrl: null,
      notes: "",
    });
    setAvatarPreview(null);
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file ảnh");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Kích thước ảnh không được vượt quá 5MB");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      setForm((f) => ({ ...f, avatarUrl: data.url }));
      setAvatarPreview(data.url);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Lỗi khi upload ảnh");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCameraCapture = () => {
    if (!cameraInputRef.current) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.capture = "environment"; // ưu tiên camera sau (mobile)
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          handleImageUpload(file);
        }
      };
      cameraInputRef.current = input;
    }
    cameraInputRef.current.click();
  };

  const handleAddMember = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      return;
    }
    try {
      setIsSaving(true);
      const isEdit = Boolean(editingId);
      const url = isEdit ? `/api/members/${editingId}` : "/api/members";
      const method = isEdit ? "PATCH" : "POST";
      const nextPayment = getNextPaymentDate(form.plan);
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, nextPayment }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Không thể lưu hội viên (kiểm tra email/SĐT trùng)");
        return;
      }
      await mutate();
      resetForm();
      setModalOpen(false);
      setEditingId(null);
    } catch (err) {
      console.error("Add member failed", err);
      alert("Không thể lưu hội viên");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (member: Member) => {
    setEditingId(member.id);
    setForm({
      name: member.name,
      phone: member.phone,
      email: member.email || "",
      plan: member.plan,
      nextPayment: member.nextPayment || getNextPaymentDate(member.plan),
      status: member.status,
      checkinsThisMonth: member.checkinsThisMonth,
      avatarUrl: member.avatarUrl || null,
      notes: member.notes || "",
    });
    setAvatarPreview(member.avatarUrl || null);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa hội viên này?")) return;
    try {
      await fetch(`/api/members/${id}`, { method: "DELETE" });
      await mutate();
    } catch (err) {
      console.error("Delete member failed", err);
      alert("Không thể xóa hội viên");
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-blue-100 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Quản lý hội viên
              </p>
              <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
                Danh sách hội viên & trạng thái gói tập
          </h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Tra cứu nhanh, lọc trạng thái, thêm hội viên mới. Giao diện tối
                ưu cho mobile và desktop.
              </p>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              + Thêm hội viên
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 ring-1 ring-blue-100">
              <p className="text-sm text-slate-600">Hội viên active</p>
              <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
              <p className="text-xs font-semibold text-green-600">
                Đang duy trì
              </p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-red-50 to-pink-50 p-4 ring-1 ring-red-100">
              <p className="text-sm text-slate-600">Cần gia hạn</p>
              <p className="text-2xl font-bold text-slate-900">
                {overdueCount}
              </p>
              <p className="text-xs font-semibold text-red-600">
                Nhắc gia hạn sớm
              </p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 ring-1 ring-blue-100">
              <p className="text-sm text-slate-600">Lượt check-in tháng</p>
              <p className="text-2xl font-bold text-slate-900">
                {monthlyCheckins}
              </p>
              <p className="text-xs font-semibold text-blue-600">
                Cập nhật realtime
              </p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 p-4 ring-1 ring-green-100">
              <p className="text-sm text-slate-600">Trạng thái tổng quan</p>
              <p className="text-2xl font-bold text-slate-900">
                {members.length} HV
              </p>
              <p className="text-xs font-semibold text-green-600">
                Quản lý tập trung
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-3xl bg-white/90 p-5 shadow-lg ring-1 ring-blue-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="relative w-full sm:w-72">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm theo tên, SĐT, email..."
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="flex gap-2">
                {(["all", "active", "overdue", "inactive"] as const).map(
                  (key) => (
                    <button
                      key={key}
                      onClick={() =>
                        setStatusFilter(key === "all" ? "all" : key)
                      }
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                        statusFilter === key
                          ? "bg-blue-500 text-white shadow"
                          : "bg-blue-50 text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100"
                      }`}
                    >
                      {key === "all"
                        ? "Tất cả"
                        : statusStyle[key].label ?? key}
                    </button>
                  )
                )}
              </div>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-green-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500"
            >
              + Thêm hội viên
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-100 shadow-sm">
            <div className="hidden min-w-full divide-y divide-zinc-100 sm:table">
              <div className="grid grid-cols-12 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <div className="col-span-4">Hội viên</div>
                <div className="col-span-2">Gói tập</div>
                <div className="col-span-2">Thanh toán kế</div>
                <div className="col-span-1 text-right">Còn lại</div>
                <div className="col-span-1">Trạng thái</div>
                <div className="col-span-2 text-right">Check-in tháng</div>
              </div>
              {(isLoading ? [] : filtered).map((member) => {
                const { label: daysLabel, overdue } = getDaysRemainingInfo(
                  member.nextPayment
                );
                return (
                  <div
                    key={member.id}
                    className="grid grid-cols-12 items-center px-4 py-3 text-sm transition hover:bg-blue-50/50"
                  >
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg text-blue-400">
                            👤
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">
                          {member.name}
                        </p>
                        <p className="text-xs text-slate-600">{member.phone}</p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-slate-800">
                        {member.plan}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-slate-800">
                        {formatDateDisplay(member.nextPayment)}
                      </p>
                    </div>
                    <div className="col-span-1 text-right">
                      <p
                        className={`text-sm font-semibold ${
                          overdue ? "text-red-600" : "text-slate-800"
                        }`}
                      >
                        {daysLabel}
                      </p>
                    </div>
                    <div className="col-span-1">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[member.status].className}`}
                      >
                        {statusStyle[member.status].label}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2 text-right">
                      <span className="font-semibold text-slate-900">
                        {member.checkinsThisMonth}
                      </span>
                      <button
                        onClick={() => handleEdit(member)}
                        className="rounded-lg border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && !isLoading && (
                <div className="px-4 py-6 text-sm text-slate-600">
                  Chưa có dữ liệu hội viên.
                </div>
              )}
            </div>

            <div className="grid gap-3 p-3 sm:hidden">
              {(isLoading ? [] : filtered).map((member) => {
                const { label: daysLabel } = getDaysRemainingInfo(
                  member.nextPayment
                );
                return (
                  <div
                    key={member.id}
                    className="space-y-2 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xl text-blue-400">
                              👤
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {member.name}
                          </p>
                          <p className="text-xs text-slate-600">{member.phone}</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[member.status].className}`}
                      >
                        {statusStyle[member.status].label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{member.plan}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                        Thanh toán kế: {formatDateDisplay(member.nextPayment)}
                      </span>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">
                        Còn lại: {daysLabel}
                      </span>
                      <span className="rounded-full bg-green-50 px-2.5 py-1 font-semibold text-green-700">
                        Check-in tháng: {member.checkinsThisMonth}
                      </span>
                    </div>
                    {member.notes && (
                      <p className="text-xs text-slate-500">Ghi chú: {member.notes}</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleEdit(member)}
                        className="flex-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && !isLoading && (
                <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-4 text-center text-sm text-slate-600">
                  Chưa có dữ liệu hội viên.
                </div>
              )}
            </div>
        </div>
        </section>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-blue-100 sm:m-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  {editingId ? "Chỉnh sửa hội viên" : "Thêm hội viên"}
                </p>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingId ? "Cập nhật hồ sơ" : "Hồ sơ hội viên mới"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                  setEditingId(null);
                }}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-zinc-200"
              >
                Đóng
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {/* Avatar Upload Section */}
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-slate-800">
                  Ảnh đại diện
                </label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                    {avatarPreview || form.avatarUrl ? (
                      <img
                        src={avatarPreview || form.avatarUrl || ""}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-blue-400">
                        👤
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleCameraCapture}
                      disabled={isUploading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>⏳ Đang upload...</>
                      ) : (
                        <>📷 Chụp ảnh</>
                      )}
                    </button>
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
                      📁 Chọn ảnh
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleImageUpload(file);
                          }
                        }}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-slate-800">
                  Họ và tên
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Nguyễn Văn A"
                  className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-800">
                  Số điện thoại
                </label>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="09xx xxx xxx"
                  className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-800">
                  Email
                </label>
                <input
                  value={form.email ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="email@example.com"
                  className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-800">
                  Gói tập
                </label>
                <select
                  value={form.plan}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, plan: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {plans.map((plan) => (
                    <option key={plan}>{plan}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-800">
                  Thanh toán kế
                </label>
                <input
                  type="date"
                  value={form.nextPayment}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nextPayment: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-800">
                  Trạng thái
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as MemberStatus }))
                  }
                  className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="overdue">Cần gia hạn</option>
                  <option value="inactive">Tạm dừng</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-800">
                  Check-in tháng
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.checkinsThisMonth}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      checkinsThisMonth: Number(e.target.value) || 0,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-slate-800">
                  Ghi chú
                </label>
                <textarea
                  value={form.notes ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Ưu tiên PT, tình trạng sức khoẻ, nhắc gia hạn..."
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => {
                  resetForm();
                  setModalOpen(false);
                }}
                className="rounded-xl border border-blue-200 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleAddMember}
                disabled={isSaving}
                className="rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? "Đang lưu..." : "Lưu hội viên"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
