import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { diskStorage } from 'multer'
import { v4 as uuidv4 } from 'uuid'

/**
 * Thư mục lưu file upload. Mặc định: <repo>/data/uploads
 * (chat service chạy với cwd = services/platform nên ../../ là gốc repo).
 */
export function resolveUploadDir(): string {
  const dir =
    process.env.UPLOAD_DIR ??
    path.resolve(process.cwd(), '..', '..', 'data', 'uploads')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export const ALLOWED_EXT = [
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
  '.md',
  '.csv',
]

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export const documentMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, resolveUploadDir()),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `${uuidv4()}${ext}`)
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (
    _req: unknown,
    file: { originalname: string },
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      cb(new Error(`Định dạng không hỗ trợ: ${ext || 'không rõ'}`), false)
      return
    }
    cb(null, true)
  },
}
