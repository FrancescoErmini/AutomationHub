import { expect, test } from '@playwright/test'

test('user can navigate to every RPA analytics dashboard', async ({ page }) => {
  await page.goto('/')
  await page
    .getByRole('link', { name: 'Open the RPA analytics portal' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'CIO Executive Overview' }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Operations' }).click()
  await expect(
    page.getByRole('heading', { name: 'RPA AMS Operations' }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'ROI' }).click()
  await expect(
    page.getByRole('heading', { name: 'ROI / Business Value' }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'SLA / Data Quality' }).click()
  await expect(
    page.getByRole('heading', {
      name: 'SLA / Service Performance / Data Quality',
    }),
  ).toBeVisible()
})

test('executive KPIs load without a client-side error state', async ({
  page,
}) => {
  await page.goto('/executive')
  await expect(
    page.getByRole('region', { name: 'Executive KPIs' }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})
