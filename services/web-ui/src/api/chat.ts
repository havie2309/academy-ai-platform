const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini'

const CHAT_URL = import.meta.env.DEV
  ? '/api/openai/v1/chat/completions'
  : 'https://api.openai.com/v1/chat/completions'

export async function sendMessage(message: string, sessionId?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (!import.meta.env.DEV) {
    const key = import.meta.env.VITE_OPENAI_API_KEY
    if (!key) throw new Error('Thiếu VITE_OPENAI_API_KEY')
    headers.Authorization = `Bearer ${key}`
  }

  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Bạn là trợ lý ảo của học viện, hỗ trợ cán bộ, giảng viên và học viên tra cứu thông tin đào tạo, khảo thí, nghiên cứu khoa học. Trả lời bằng tiếng Việt, ngắn gọn và chính xác.',
        },
        { role: 'user', content: message },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg =
      (body as { error?: { message?: string } })?.error?.message ??
      `OpenAI API error (${res.status})`
    throw new Error(msg)
  }

  const data = await res.json()
  return {
    answer: data.choices[0].message.content as string,
    citations: [] as unknown[],
    session_id: sessionId ?? '',
  }
}
