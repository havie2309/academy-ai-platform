import { expect, test } from '@playwright/test'
import { expectJsonRequest, loginAs } from './helpers'

test('admin can review health, update AI policy, manage accounts, and inspect audit logs', async ({
  page,
}) => {
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

  const overview = {
    generated_at: '2026-06-24T07:30:00.000Z',
    quota_policy: {
      rate_limit_auth_per_minute: 60,
      rate_limit_anon_per_minute: 10,
      load_shedding_max_concurrent: 100,
      access_token_ttl: '15m',
      refresh_token_ttl_days: 7,
      login_max_attempts: 5,
      login_lock_duration_seconds: 900,
    },
    account_summary: {
      total_users: 74,
      active_users: 68,
      inactive_users: 4,
      locked_users: 2,
      admin_like_users: 4,
      temporary_locked_users: 1,
    },
    token_summary: {
      active_refresh_sessions: 12,
      sessions_expiring_24h: 3,
      refreshes_24h: 7,
      revoked_sessions_24h: 2,
    },
    usage_summary: {
      failed_logins_24h: 5,
      successful_logins_24h: 19,
      chat_sessions_7d: 23,
      chat_messages_7d: 120,
      active_chat_users_7d: 11,
    },
    sources: {
      mongo_available: true,
      redis_available: true,
    },
  }

  const accounts = [
    {
      user_id: 'USR005',
      username: '676156',
      email: 'lekimdung@pm2.edu.vn',
      full_name: 'Le Kim Dung',
      department: 'KT',
      max_security_level: 1,
      status: 'active',
      roles: ['HOC_VIEN'],
      last_login_at: '2026-06-24T05:00:00.000Z',
      temporary_locked: true,
      active_refresh_sessions: 2,
      last_refreshed_at: '2026-06-24T06:00:00.000Z',
      failed_logins_7d: 1,
      refreshes_7d: 4,
      chat_sessions_total: 6,
      chat_messages_30d: 18,
      last_chat_at: '2026-06-23T08:00:00.000Z',
    },
  ]

  const auditLogs = [
    {
      id: 101,
      user_id: 'admin',
      action: 'policy.update',
      resource_type: 'admin_config',
      resource_id: 'rag_policy',
      old_value: { enabled: false },
      new_value: { enabled: true },
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0',
      status: 'success' as const,
      reason: 'Bo sung policy cho dot khao thi',
      created_at: '2026-06-24T06:45:00.000Z',
    },
    {
      id: 102,
      user_id: 'admin',
      action: 'account.lock',
      resource_type: 'user',
      resource_id: 'USR005',
      old_value: { status: 'active' },
      new_value: { status: 'locked' },
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0',
      status: 'failure' as const,
      reason: 'Tam khoa de dieu tra dang nhap bat thuong',
      created_at: '2026-06-24T06:50:00.000Z',
    },
  ]

  const auditDetails = {
    101: {
      ...auditLogs[0],
      old_value: {
        enabled: false,
        blacklistKeywords: ['de thi'],
        safeRefusalMessage: 'Thong diep cu',
      },
      new_value: {
        enabled: true,
        blacklistKeywords: ['de thi', 'dap an', 'noi dung cam'],
        safeRefusalMessage: 'Tam thoi chua the ho tro yeu cau nay.',
      },
    },
    102: {
      ...auditLogs[1],
      old_value: {
        status: 'active',
        active_refresh_sessions: 2,
      },
      new_value: {
        status: 'locked',
        active_refresh_sessions: 0,
      },
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

      if (url.pathname === '/api/users/admin/overview' && request.method() === 'GET') {
        await route.fulfill({ json: overview })
        return
      }

      if (url.pathname === '/api/users/admin/accounts' && request.method() === 'GET') {
        await route.fulfill({ json: accounts })
        return
      }

      if (
        url.pathname === '/api/users/admin/accounts/USR005/status' &&
        request.method() === 'PATCH'
      ) {
        const next = request.postDataJSON() as { status: string }

        await route.fulfill({
          json: {
            message: 'Da cap nhat trang thai tai khoan.',
            revoked_count: next.status === 'locked' ? 2 : 0,
            account: {
              ...accounts[0],
              status: next.status,
              temporary_locked:
                next.status === 'active' ? false : accounts[0].temporary_locked,
            },
          },
        })
        return
      }

      if (url.pathname === '/api/audit/logs' && request.method() === 'GET') {
        await route.fulfill({ json: auditLogs })
        return
      }

      if (url.pathname.startsWith('/api/audit/logs/') && request.method() === 'GET') {
        const id = Number(url.pathname.split('/').at(-1))
        const detail = auditDetails[id as keyof typeof auditDetails]

        if (!detail) {
          await route.fulfill({
            status: 404,
            json: { message: 'Not found' },
          })
          return
        }

        await route.fulfill({ json: detail })
        return
      }

      await route.abort()
    },
  )

  await loginAs(page, 'admin')

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByTestId('admin-page')).toBeVisible()
  await expect(page.getByTestId('health-card-userManagement')).toBeVisible()
  await expect(page.getByTestId('health-card-rag')).toBeVisible()
  await expect(page.getByTestId('policy-keywords')).toHaveValue('de thi\ndap an')
  await expect(page.getByTestId('admin-ops-section')).toBeVisible()
  await expect(page.getByTestId('account-row-USR005')).toContainText('676156')

  await page
    .getByTestId('policy-keywords')
    .fill('de thi\nde thi, dap an\nnoi dung cam')
  await page
    .getByTestId('policy-safe-refusal')
    .fill('Tam thoi chua the ho tro yeu cau nay.')
  await page
    .getByTestId('policy-reason')
    .fill('Bo sung policy cho dot khao thi')

  const payload = await expectJsonRequest(page, '/api/admin-config/rag-policy', async () => {
    await page.getByTestId('policy-save').click()
  })

  expect(payload).toMatchObject({
    enabled: true,
    blacklistKeywords: ['de thi', 'dap an', 'noi dung cam'],
    safeRefusalMessage: 'Tam thoi chua the ho tro yeu cau nay.',
    reason: 'Bo sung policy cho dot khao thi',
  })

  await expect(page.getByTestId('policy-save-message')).toBeVisible()
  await expect(page.getByText('v4').first()).toBeVisible()

  const statusPayload = await expectJsonRequest(
    page,
    '/api/users/admin/accounts/USR005/status',
    async () => {
      await page.getByTestId('account-lock-USR005').click()
    },
  )

  expect(statusPayload).toMatchObject({ status: 'locked' })

  const auditSection = page.getByTestId('admin-audit-section')
  const auditDetailPanel = page.getByTestId('audit-detail-panel')

  await expect(auditSection).toBeVisible()
  await expect(page.getByTestId('audit-row-101')).toContainText('policy.update')
  await expect(auditDetailPanel).toContainText('#101 | policy.update')
  await expect(auditDetailPanel).toContainText('safeRefusalMessage')

  await page.getByTestId('audit-row-102').click()
  await expect(auditDetailPanel).toContainText('#102 | account.lock')
  await expect(auditDetailPanel).toContainText('Tam khoa de dieu tra dang nhap bat thuong')

  await auditSection.getByPlaceholder('login, update, delete...').fill('policy.update')
  await auditSection
    .getByPlaceholder('auth, admin_config, document...')
    .fill('admin_config')
  await auditSection.getByPlaceholder('admin', { exact: true }).fill('admin')
  await auditSection
    .getByPlaceholder('rag-policy, DOC-001...')
    .fill('rag_policy')
  await auditSection.locator('input[type="datetime-local"]').nth(0).fill('2026-06-24T13:30')
  await auditSection.locator('input[type="datetime-local"]').nth(1).fill('2026-06-24T14:00')
  await auditSection.getByRole('combobox').nth(0).selectOption('success')
  await auditSection.getByRole('combobox').nth(1).selectOption('100')

  const filterRequestPromise = page.waitForRequest((request) => {
    if (request.method() !== 'GET') return false

    const url = new URL(request.url())
    return (
      url.pathname === '/api/audit/logs' &&
      url.searchParams.get('status') === 'success' &&
      url.searchParams.get('action') === 'policy.update' &&
      url.searchParams.get('resourceType') === 'admin_config' &&
      url.searchParams.get('userId') === 'admin' &&
      url.searchParams.get('resourceId') === 'rag_policy' &&
      url.searchParams.get('from') === '2026-06-24T06:30:00.000Z' &&
      url.searchParams.get('to') === '2026-06-24T07:00:00.000Z' &&
      url.searchParams.get('limit') === '100'
    )
  })

  await page.getByTestId('audit-apply').click()
  await filterRequestPromise

  const exportJsonRequestPromise = page.waitForRequest((request) => {
    if (request.method() !== 'GET') return false

    const url = new URL(request.url())
    return (
      url.pathname === '/api/audit/logs' &&
      url.searchParams.get('status') === 'success' &&
      url.searchParams.get('action') === 'policy.update' &&
      url.searchParams.get('resourceType') === 'admin_config' &&
      url.searchParams.get('userId') === 'admin' &&
      url.searchParams.get('resourceId') === 'rag_policy' &&
      url.searchParams.get('from') === '2026-06-24T06:30:00.000Z' &&
      url.searchParams.get('to') === '2026-06-24T07:00:00.000Z' &&
      url.searchParams.get('limit') === '500'
    )
  })

  await page.getByTestId('audit-export-json').click()
  await exportJsonRequestPromise
  await expect(auditSection).toContainText('Da xuat 2 dong audit theo bo loc hien tai (JSON).')

  const exportCsvRequestPromise = page.waitForRequest((request) => {
    if (request.method() !== 'GET') return false

    const url = new URL(request.url())
    return (
      url.pathname === '/api/audit/logs' &&
      url.searchParams.get('status') === 'success' &&
      url.searchParams.get('action') === 'policy.update' &&
      url.searchParams.get('resourceType') === 'admin_config' &&
      url.searchParams.get('userId') === 'admin' &&
      url.searchParams.get('resourceId') === 'rag_policy' &&
      url.searchParams.get('from') === '2026-06-24T06:30:00.000Z' &&
      url.searchParams.get('to') === '2026-06-24T07:00:00.000Z' &&
      url.searchParams.get('limit') === '500'
    )
  })

  await page.getByTestId('audit-export-csv').click()
  await exportCsvRequestPromise
  await expect(auditSection).toContainText('Da xuat 2 dong audit theo bo loc hien tai (CSV).')
})
