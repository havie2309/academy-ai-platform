import { BadRequestException } from '@nestjs/common'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { diskStorage } from 'multer'
import { v4 as uuidv4 } from 'uuid'

/**
 * Thu muc luu file upload. Mac dinh: <repo>/data/uploads
 * (chat service chay voi cwd = services/platform nen ../../ la goc repo).
 */
export function resolveUploadDir(): string {
  const dir =
    process.env.UPLOAD_DIR ??
    path.resolve(process.cwd(), '..', '..', 'data', 'uploads')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export const ALLOWED_EXT = ['.pdf', '.docx']

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export const SUPPORTED_UPLOAD_MESSAGE =
  'Hien chi ho tro tai len file PDF (.pdf) va Word (.docx).'

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
      cb(
        new BadRequestException(SUPPORTED_UPLOAD_MESSAGE) as unknown as Error,
        false,
      )
      return
    }
    cb(null, true)
  },
}
