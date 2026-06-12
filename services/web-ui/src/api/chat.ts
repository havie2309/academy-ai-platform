const API_URL = 'http://localhost:3000';

export async function sendMessage(message: string, sessionId?: string) {
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  if (!res.ok) throw new Error('API error');
  return res.json() as Promise<{
    answer: string;
    citations: any[];
    session_id: string;
  }>;
}