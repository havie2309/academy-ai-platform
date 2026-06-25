import type { ReactNode } from 'react'
import { Wrench } from 'lucide-react'

interface AdminTechnicalDetailsProps {
  title?: string
  description?: string
  children: ReactNode
  testId?: string
}

export default function AdminTechnicalDetails({
  title = 'Chi tiết kỹ thuật',
  description,
  children,
  testId,
}: AdminTechnicalDetailsProps) {
  return (
    <details
      data-testid={testId}
      className="rounded-2xl border border-slate-200/70 bg-slate-50/70"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white p-2 text-slate-500 shadow-sm">
            <Wrench size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {description}
              </p>
            )}
          </div>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Mở
        </span>
      </summary>

      <div className="border-t border-slate-200 px-4 py-4">{children}</div>
    </details>
  )
}
