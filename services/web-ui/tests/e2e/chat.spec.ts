import { expect, test } from '@playwright/test'
import { loginAs } from './helpers'

test('user can send a message, stream an answer, show citations, and delete the session', async ({
  page,
}) => {
  const session = {
    id: 'session-1',
    title: 'Lich thi hoc ky 2',
    created_at: '2026-06-18T10:00:00.000Z',
    updated_at: '2026-06-18T10:00:30.000Z',
  }

  await page.route(
    (url) => new URL(url.toString()).pathname.startsWith('/api/'),
    async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (url.pathname === '/api/chat/sessions' && request.method() === 'GET') {
      await route.fulfill({ json: [] })
      return
    }

    if (url.pathname === '/api/chat/sessions' && request.method() === 'POST') {
      await route.fulfill({ json: session })
      return
    }

    if (url.pathname === '/api/chat/sessions/session-1' && request.method() === 'DELETE') {
      await route.fulfill({ status: 204, body: '' })
      return
    }

    if (url.pathname === '/api/chat/sessions/session-1/messages' && request.method() === 'GET') {
      await route.fulfill({ json: [] })
      return
    }

    if (url.pathname === '/api/chat/sessions/session-1/messages/stream' && request.method() === 'POST') {
      const sse = [
        'event: meta',
        `data: ${JSON.stringify({
          user_message: {
            id: 'user-1',
            session_id: session.id,
            role: 'user',
            content: 'Lich thi hoc ky 2 khi nao?',
            created_at: '2026-06-18T10:00:05.000Z',
          },
          citations: [
            {
              doc_id: 'doc-1',
              chunk_id: 'chunk-1',
              title: 'Thong bao lich thi',
              page: 2,
              snippet: 'Lich thi hoc ky 2 bat dau tu ngay 20/06.',
              source: 'Thong bao lich thi',
              section_path: 'Hoc vu > Lich thi',
            },
          ],
          route: 'rag',
        })}`,
        '',
        'event: token',
        `data: ${JSON.stringify({ delta: 'Lich thi hoc ky 2 bat dau tu ngay 20/06.' })}`,
        '',
        'event: done',
        `data: ${JSON.stringify({
          session,
          assistant_message: {
            id: 'assistant-1',
            session_id: session.id,
            role: 'assistant',
            content: 'Lich thi hoc ky 2 bat dau tu ngay 20/06.',
            created_at: '2026-06-18T10:00:15.000Z',
            citations: [
              {
                doc_id: 'doc-1',
                chunk_id: 'chunk-1',
                title: 'Thong bao lich thi',
                page: 2,
                snippet: 'Lich thi hoc ky 2 bat dau tu ngay 20/06.',
                source: 'Thong bao lich thi',
                section_path: 'Hoc vu > Lich thi',
              },
            ],
          },
          citations: [
            {
              doc_id: 'doc-1',
              chunk_id: 'chunk-1',
              title: 'Thong bao lich thi',
              page: 2,
              snippet: 'Lich thi hoc ky 2 bat dau tu ngay 20/06.',
              source: 'Thong bao lich thi',
              section_path: 'Hoc vu > Lich thi',
            },
          ],
          route: 'rag',
        })}`,
        '',
        '',
      ].join('\n')

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sse,
      })
      return
    }

    await route.abort()
    },
  )

  await loginAs(page, 'hv001')

  await expect(page).toHaveURL(/\/chat$/)
  await expect(page.getByTestId('chat-page')).toBeVisible()

  await page.getByTestId('chat-input').fill('Lich thi hoc ky 2 khi nao?')
  await page.getByTestId('chat-send').click()

  await expect(page).toHaveURL(/\/chat\/session-1$/)
  await expect(page.getByTestId('chat-message-user')).toContainText('Lich thi hoc ky 2 khi nao?')
  await expect(page.getByTestId('chat-message-assistant').last()).toContainText(
    'Lich thi hoc ky 2 bat dau tu ngay 20/06.',
  )
  await expect(page.getByTestId('citation-list')).toBeVisible()
  await expect(page.getByTestId('citation-card')).toContainText('Thong bao lich thi')
  await expect(page.getByTestId('sidebar-session-session-1')).toBeVisible()

  await page.getByTestId('chat-delete-session').click()

  await expect(page).toHaveURL(/\/chat$/)
  await expect(page.getByTestId('chat-suggestion').first()).toBeVisible()
})
