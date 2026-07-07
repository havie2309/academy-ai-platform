import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { 
  MessageSquare, 
  Search, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Database
} from 'lucide-react'

function MockChatUI({ isVisible }: { isVisible: boolean }) {
  return (
    <div className="w-full bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl p-5 select-none font-sans max-w-md mx-auto relative overflow-hidden group">
      {/* Glossy Shimmer Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-blue-500/[0.02] to-transparent pointer-events-none" />

      {/* Title Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/90" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/90" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/90" />
        </div>
        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">edumind_assistant_session</span>
        <div className="w-8" />
      </div>

      {/* Messages */}
      <div className="space-y-3.5 min-h-[160px] flex flex-col justify-end">
        {/* User Message */}
        <div className={`flex items-start gap-2.5 justify-end transition-all duration-555 ${isVisible ? 'animate-message-1' : 'opacity-0'}`}>
          <div className="bg-blue-600 text-white rounded-2xl rounded-tr-none px-3.5 py-2 text-xs max-w-[80%] shadow-sm leading-relaxed">
            Tóm tắt hộ tôi điều kiện dự thi học kỳ trong quy chế đào tạo.
          </div>
          <div className="w-6.5 h-6.5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0 text-slate-300">
            US
          </div>
        </div>

        {/* AI Message */}
        <div className={`flex items-start gap-2.5 transition-all duration-555 ${isVisible ? 'animate-message-2' : 'opacity-0'}`}>
          <div className="w-6.5 h-6.5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0 text-white shadow-md shadow-blue-600/30 animate-pulse">
            EM
          </div>
          <div className="bg-slate-850 border border-slate-800 rounded-2xl rounded-tl-none px-3.5 py-2.5 text-xs max-w-[80%] text-slate-300 space-y-2 leading-relaxed shadow-sm relative overflow-hidden">
            {/* Shimmer effect inside AI answer */}
            <div className="absolute inset-0 -translate-x-full animate-shimmer pointer-events-none" />
            <p>Chào bạn! Theo Quy chế Đào tạo hiện hành:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1 text-[11px]">
              <li>Đi học chuyên cần đạt tối thiểu <strong className="text-blue-400">80%</strong> số tiết lý thuyết.</li>
              <li>Hoàn thành đầy đủ các bài tập thực hành/thực tập.</li>
              <li>Không vi phạm kỷ luật đình chỉ học tập.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Input */}
      {/* Input */}
      <div className={`mt-4 pt-3.5 border-t border-slate-800/80 transition-all duration-555 ${isVisible ? 'animate-message-3' : 'opacity-0'}`}>
        <div className="w-full bg-slate-850 border border-slate-800 rounded-xl px-3 py-2 text-slate-500 text-xs flex items-center justify-between">
          <span className="text-[11px]">Hỏi EduMind điều gì đó...</span>
          <span className="w-4 h-4 bg-slate-850 rounded border border-slate-700 flex items-center justify-center text-[9px] text-slate-400 font-mono">↵</span>
        </div>
      </div>
    </div>
  )
}

function MockSearchUI({ isVisible }: { isVisible: boolean }) {
  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200/80 shadow-xl p-5 select-none font-sans max-w-md mx-auto relative overflow-hidden group">
      {/* Title Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
        </div>
        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">semantic_search_engine</span>
        <div className="w-8" />
      </div>

      {/* Search Input with RAG Scan Line */}
      <div className="relative mb-4 overflow-hidden rounded-xl border border-slate-200/60 shadow-inner">
        {/* RAG Laser Scanner Line */}
        <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-70 animate-scanline" />
        
        <div className="w-full bg-slate-50 py-2 px-3 pl-8 text-xs text-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">🔍</span>
            <span className="font-semibold text-slate-800 text-[11px]">quy chế tuyển sinh thạc sĩ 2026</span>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-[9px] text-indigo-600 font-bold border border-indigo-100/70 relative overflow-hidden shrink-0">
            <span className="absolute inset-0 -translate-x-full animate-shimmer-light pointer-events-none" />
            RAG
          </span>
        </div>
      </div>

      {/* Search Results */}
      <div className="space-y-3">
        {/* Item 1 */}
        <div className={`p-3 bg-slate-50/50 border border-slate-150/50 rounded-xl space-y-1.5 relative overflow-hidden transition-all duration-555 ${isVisible ? 'animate-message-1' : 'opacity-0'}`}>
          <div className="absolute inset-0 -translate-x-full animate-shimmer-light pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              📄 Quy-che-Tuyen-sinh-Thac-si.pdf
            </span>
            <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold border border-emerald-100/70">
              98% Phù hợp
            </span>
          </div>
          
          <div className="text-[11px] text-slate-500 leading-relaxed bg-white border border-slate-100 rounded-lg p-2 font-mono relative">
            "...thí sinh đăng ký dự tuyển trình độ Thạc sĩ phải tốt nghiệp Đại học ngành đúng hoặc phù hợp với ngành..."
            <span className="ml-1 text-blue-500 font-bold font-sans underline cursor-pointer">[Trang 4, Mục 2]</span>
          </div>
        </div>

        {/* Item 2 */}
        <div className={`p-2.5 bg-slate-50/20 border border-slate-100/40 rounded-xl flex items-center justify-between text-[11px] transition-all duration-555 ${isVisible ? 'animate-message-2' : 'opacity-0'}`}>
          <span className="text-slate-600 font-medium flex items-center gap-1.5">
            📄 Huong-dan-on-tap-tuyen-sinh.docx
          </span>
          <span className="text-[9px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">
            85%
          </span>
        </div>
      </div>
    </div>
  )
}

function ScrollTriggered({ children, delay = '0s' }: { children: (isVisible: boolean) => React.ReactNode; delay?: string }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.15 }
    )
    if (ref.current) {
      observer.observe(ref.current)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="w-full lg:w-1/2 flex items-center justify-center p-2 animate-float" style={{ animationDelay: delay }}>
      {children(isVisible)}
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const user = authApi.getUser()
  const displayName = user?.full_name ?? 'Khách'

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 bg-grid-pattern">
      {/* Dynamic Background Glows */}
      <div className="relative w-full min-h-screen px-6 py-8 md:px-12 md:py-12 flex flex-col items-center">
        
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse-glow animate-float" />
        <div className="absolute top-1/3 right-1/4 translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-3xl animate-pulse-glow animate-float" style={{ animationDelay: '-3s' }} />

        {/* Hero Welcome Banner */}
        <div className="w-full max-w-5xl animate-fade-in relative z-10 text-center md:text-left mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-semibold mb-4 shadow-sm">
            <Sparkles size={13} className="animate-pulse" />
            <span>Hệ thống Trợ lý ảo Học thuật & Tra cứu thông minh</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-800 leading-tight">
            Xin chào, <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{displayName}</span>!
          </h1>
          <p className="mt-3 text-base md:text-lg text-slate-500 max-w-2xl font-medium">
            Chào mừng bạn đến với <span className="font-semibold text-slate-700">EduMind</span>. Hãy chọn một công cụ bên dưới để bắt đầu phiên làm việc của bạn.
          </p>
        </div>

        {/* Major Action Buttons (CTAs) */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 mb-16 animate-slide-up relative z-10">
          
          {/* CTA: Chat AI */}
          <div 
            onClick={() => navigate('/chat')}
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/5 cursor-pointer"
          >
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-colors" />
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform duration-300">
                <MessageSquare size={26} />
              </div>
              <h2 className="mt-6 text-2xl font-bold text-slate-800 flex items-center gap-2">
                Hội thoại AI (Chat AI)
                <Sparkles size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-500">
                Trò chuyện trực tiếp với Trợ lý ảo EduMind. Đặt câu hỏi, soạn thảo văn bản, tóm tắt nội dung, dịch thuật và phân tích học liệu tức thì.
              </p>
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm font-bold text-blue-600">
              <span>Bắt đầu cuộc trò chuyện</span>
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* CTA: Tra cứu tài liệu */}
          <div 
            onClick={() => navigate('/docs/tra-cuu')}
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/5 cursor-pointer"
          >
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-colors" />
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 group-hover:scale-110 transition-transform duration-300">
                <Search size={26} />
              </div>
              <h2 className="mt-6 text-2xl font-bold text-slate-800 flex items-center gap-2">
                Tra cứu tài liệu
                <Sparkles size={16} className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-500">
                Tìm kiếm ngữ nghĩa nâng cao (RAG) trong kho học liệu học viện. Truy xuất thông tin chính xác từng đoạn văn bản kèm trích dẫn tài liệu gốc.
              </p>
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm font-bold text-indigo-600">
              <span>Tra cứu thông tin ngay</span>
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </div>
          </div>

        </div>

        {/* App Showcase & Features Introduction */}
        <div className="w-full max-w-5xl mb-16 animate-slide-up relative z-10" style={{ animationDelay: '0.15s' }}>
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-800">Trải nghiệm các tính năng cốt lõi</h2>
            <p className="text-sm text-slate-400 mt-1">Hệ thống tối ưu hóa cho công tác giảng dạy, nghiên cứu và quản lý</p>
          </div>

          <div className="space-y-12">
            
            {/* Feature 1: AI Chat Assistant */}
            <div className="flex flex-col lg:flex-row items-center gap-8 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/50 shadow-sm">
              <div className="w-full lg:w-1/2 space-y-4">
                <span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold uppercase tracking-wider">
                  Trò chuyện thông minh
                </span>
                <h3 className="text-xl md:text-2xl font-bold text-slate-800">Trợ lý ảo học thuật 24/7</h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  EduMind sở hữu mô hình ngôn ngữ lớn mạnh mẽ được tinh chỉnh riêng. Hệ thống hỗ trợ giải đáp mọi thắc mắc học tập, hướng dẫn quy chế đào tạo, lập dàn ý bài giảng hoặc dịch thuật tài liệu đa ngôn ngữ với độ chính xác cao.
                </p>
                <ul className="space-y-2.5 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">✓</span>
                    <span>Tương tác ngôn ngữ tự nhiên tiếng Việt mượt mà</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">✓</span>
                    <span>Hỗ trợ ghi nhớ ngữ cảnh hội thoại sâu rộng</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">✓</span>
                    <span>Khởi tạo cuộc hội thoại mới chỉ với một cú click</span>
                  </li>
                </ul>
              </div>
              <ScrollTriggered>
                {(isVisible) => <MockChatUI isVisible={isVisible} />}
              </ScrollTriggered>
            </div>

            {/* Feature 2: Document RAG Engine */}
            <div className="flex flex-col lg:flex-row-reverse items-center gap-8 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/50 shadow-sm">
              <div className="w-full lg:w-1/2 space-y-4">
                <span className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold uppercase tracking-wider">
                  Tra cứu nâng cao
                </span>
                <h3 className="text-xl md:text-2xl font-bold text-slate-800">Tìm kiếm ngữ nghĩa & Trích dẫn gốc</h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  Không còn tốn thời gian lướt hàng trăm trang tài liệu để tìm một ý nhỏ. Với công nghệ RAG (Retrieval-Augmented Generation), hệ thống sẽ tìm kiếm thông minh dựa trên ý nghĩa câu hỏi, trích xuất chính xác đoạn văn chứa câu trả lời và dẫn nguồn trực tiếp từ file PDF, Word gốc.
                </p>
                <ul className="space-y-2.5 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">✓</span>
                    <span>Hỗ trợ đa định dạng học liệu (PDF, Docx, Xlsx, PPTX, TXT)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">✓</span>
                    <span>Chỉ mục hóa (ingest) tự động bằng thuật toán AI</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">✓</span>
                    <span>Trích dẫn trực quan và tải xuống file nguồn dễ dàng</span>
                  </li>
                </ul>
              </div>
              <ScrollTriggered delay="-2.5s">
                {(isVisible) => <MockSearchUI isVisible={isVisible} />}
              </ScrollTriggered>
            </div>

          </div>
        </div>

        {/* Security and Performance Highlights */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up relative z-10" style={{ animationDelay: '0.25s' }}>
          
          <div className="flex gap-4 p-5 rounded-2xl bg-white/50 border border-slate-200/40">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Bảo mật On-Premise</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Mô hình LLM và dữ liệu lưu trữ 100% tại máy chủ nội bộ. Tuyệt đối không rò rỉ thông tin ra internet.
              </p>
            </div>
          </div>

          <div className="flex gap-4 p-5 rounded-2xl bg-white/50 border border-slate-200/40">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Zap size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Tốc độ & Hiệu năng</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Nhận câu trả lời và kết quả tra cứu trong vài giây nhờ đường truyền mạng nội bộ siêu tốc.
              </p>
            </div>
          </div>

          <div className="flex gap-4 p-5 rounded-2xl bg-white/50 border border-slate-200/40">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Database size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Phân quyền Dữ liệu (RAG)</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Tìm kiếm thông minh được cá nhân hóa theo vai trò của bạn, bảo đảm quyền truy cập tài liệu mật.
              </p>
            </div>
          </div>

        </div>



        {/* System Services Status Section */}
        <div className="w-full max-w-5xl mt-4 mb-12 animate-slide-up relative z-10" style={{ animationDelay: '0.4s' }}>
          <div className="bg-white/40 backdrop-blur-sm border border-slate-200/30 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-slate-650">Trạng thái hệ thống: Hoạt động ổn định</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 justify-center text-slate-400 font-mono text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Ollama (Qwen2.5-3B)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Milvus Vector DB</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>MongoDB Chat</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>API Gateway</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Tech Footer */}
        <div className="w-full max-w-5xl border-t border-slate-200/30 pt-8 pb-12 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400 relative z-10">
          <div>
            <p className="font-semibold text-slate-500">EduMind Trợ Lý Ảo</p>
            <p className="mt-1">Cổng khai thác học liệu & phân tích học thuật nội bộ học viện.</p>
          </div>
          <div className="text-center md:text-right">
            <p>© 2026 Học Viện Đào Tạo. Bảo lưu mọi quyền.</p>
            <p className="mt-1 font-mono text-[10px] text-slate-350">Phiên bản v1.2.0 (On-Premise Deployment)</p>
          </div>
        </div>

      </div>
    </div>
  )
}
