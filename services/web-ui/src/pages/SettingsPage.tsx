import { Bot, Info, Server, Settings, Shield } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50/50 p-6 md:p-8">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-800">
          <Settings className="text-blue-600" />
          Cài đặt hệ thống
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Khu vực này chỉ dành cho admin để theo dõi và điều chỉnh cấu hình vận hành.
        </p>
      </div>

      <div className="max-w-4xl space-y-6">
        <div className="rounded-3xl border border-blue-100 bg-blue-50/80 p-5 text-sm text-blue-800 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2 text-blue-600 shadow-sm">
              <Info size={18} />
            </div>
            <div>
              <p className="font-semibold">Thiết lập tài khoản cá nhân đã được tách riêng.</p>
              <p className="mt-1 leading-relaxed text-blue-700">
                Admin vẫn dùng tab <span className="font-semibold">Hồ sơ tài khoản</span> để đổi họ tên,
                mật khẩu và quản lý phiên đăng nhập của chính mình. Trang này dành cho cấu hình ở mức hệ thống.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <Bot size={18} />
              </div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
                Chính sách AI
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Quản lý rule guardrail, nội dung safe refusal và các kiểm thử prompt trong dashboard admin.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <Shield size={18} />
              </div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
                Bảo mật
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Theo dõi security alerts, phiên bị thu hồi và các lớp bảo vệ token ngay trong dashboard admin.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <Server size={18} />
              </div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
                Dịch vụ hệ thống
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Kiểm tra trạng thái gateway, audit, RAG, ETL và các kết nối nội bộ trước khi thao tác quản trị.
            </p>
          </article>
        </div>
      </div>
    </div>
  )
}
