import { useState } from 'react'
import { Settings, User, Shield, Save, Info } from 'lucide-react'

export default function SettingsPage() {
  const [successMsg, setSuccessMsg] = useState('')

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMsg('Đã lưu cấu hình thành công!')
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-6 md:p-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Settings className="text-blue-600 animate-[spin_8s_linear_infinite]" />
          Cài đặt hệ thống
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Cấu hình thông tin tài khoản và bảo mật.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
        {/* Profile Card */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-4">
            <User size={18} className="text-blue-600" />
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Hồ sơ cá nhân</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Họ và tên</label>
              <input
                type="text"
                defaultValue="Nguyễn Văn Admin"
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Email</label>
              <input
                type="email"
                defaultValue="admin@academy.edu"
                disabled
                className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-400 outline-none cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Security & System Settings */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-4">
            <Shield size={18} className="text-blue-600" />
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Bảo mật & Hệ thống</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Mật khẩu hiện tại</label>
              <input
                type="password"
                placeholder="••••••••"
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Mật khẩu mới</label>
              <input
                type="password"
                placeholder="Nhập mật khẩu mới"
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-600/15 transition-all cursor-pointer"
          >
            <Save size={16} />
            Lưu thay đổi
          </button>
          
          {successMsg && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-100 animate-fade-in">
              <Info size={14} />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
