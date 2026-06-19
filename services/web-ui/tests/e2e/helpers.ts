import { expect, type Page } from '@playwright/test'

export async function loginAs(page: Page, username: string) {
  await page.goto('/login')
  await expect(page.getByTestId('login-page')).toBeVisible()
  await page.getByTestId('login-username').fill(username)
  await page.getByTestId('login-password').fill('123456')
  await page.getByTestId('login-submit').click()
}

export async function expectJsonRequest(
  page: Page,
  urlPart: string,
  action: () => Promise<void>,
) {
  const requestPromise = page.waitForRequest((request) => {
    return request.url().includes(urlPart) && request.method() !== 'GET'
  })

  await action()

  const request = await requestPromise
  const body = request.postDataJSON()
  expect(body).toBeTruthy()
  return body as Record<string, unknown>
}
