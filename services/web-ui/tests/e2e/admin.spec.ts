import { expect, test } from '@playwright/test'
import { expectJsonRequest, loginAs } from './helpers'

test('admin can review health and update AI policy', async ({ page }) => {
  const policy = {
    config_key: 'rag_policy',
    version: 3,
    updated_at: '2026-06-18T08:00:00.000Z',
    value: {
      enabled: true,
      blacklistKeywords: ['de thi', 'dap an'],
      safeRefusalMessage: 'Xin loi, yeu cau nay da bi chan.',
    },
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

    if (url.pathname === '/api/health' && request.method() === 'GET') {
      await route.fulfill({
        json: {
          status: 'degraded',
          service: 'api-gateway',
          timestamp: '2026-06-18T08:30:00.000Z',
          upstream: {
            userManagement: 'up',
            chat: 'up',
            rbac: 'up',
            adminConfig: 'up',
            audit: 'down',
            rag: 'down',
          },
        },
      })
      return
    }

    if (url.pathname === '/api/admin-config/rag-policy' && request.method() === 'GET') {
      await route.fulfill({ json: policy })
      return
    }

    if (url.pathname === '/api/admin-config/rag-policy' && request.method() === 'PUT') {
      const next = request.postDataJSON() as {
        enabled: boolean
        blacklistKeywords: string[]
        safeRefusalMessage: string
      }
      await route.fulfill({
        json: {
          ...policy,
          version: policy.version + 1,
          updated_at: '2026-06-18T09:15:00.000Z',
          value: next,
        },
      })
      return
    }

    await route.abort()
    },
  )

  await loginAs(page, 'admin')

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByTestId('admin-page')).toBeVisible()
  await expect(page.getByTestId('health-card-userManagement')).toContainText('up')
  await expect(page.getByTestId('health-card-rag')).toContainText('down')
  await expect(page.getByTestId('policy-keywords')).toHaveValue('de thi\ndap an')

  await page.getByTestId('policy-keywords').fill('de thi\nde thi, dap an\nnoi dung cam')
  await page.getByTestId('policy-safe-refusal').fill('Tam thoi chua the ho tro yeu cau nay.')
  await page.getByTestId('policy-reason').fill('Bo sung policy cho dot khao thi')

  const payload = await expectJsonRequest(page, '/api/admin-config/rag-policy', async () => {
    await page.getByTestId('policy-save').click()
  })

  expect(payload).toMatchObject({
    enabled: true,
    blacklistKeywords: ['de thi', 'dap an', 'noi dung cam'],
    safeRefusalMessage: 'Tam thoi chua the ho tro yeu cau nay.',
    reason: 'Bo sung policy cho dot khao thi',
  })

  await expect(page.getByTestId('policy-save-message')).toContainText('Da luu AI policy thanh cong.')
  await expect(page.getByText('v4').first()).toBeVisible()
})
