import { expect, test } from '@playwright/test'

test('user can navigate, create, and list an item', async ({ page }) => {
  const uniqueName = `Browser item ${Date.now()}`
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: /Build reliable automation/i }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Manage items' }).click()
  await page.getByLabel('Name').fill(uniqueName)
  await page.getByLabel('Description').fill('Created by Playwright')
  await page.getByRole('button', { name: 'Create item' }).click()
  await expect(page.getByRole('heading', { name: uniqueName })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: uniqueName })).toBeVisible()
})
