import { expect, test } from '@playwright/test'

test('user can submit a new idea through the wizard and see it on the pipeline', async ({
  page,
}) => {
  const uniqueTitle = `Automate invoice matching ${Date.now()}`

  await page.goto('/ideas')
  await expect(
    page.getByRole('heading', { name: 'Idea Pipeline' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Submit new idea' }).click()
  await expect(
    page.getByRole('heading', { name: 'Submit New Idea' }),
  ).toBeVisible()

  // Step 1 -- Basic Info
  await page.getByLabel('Idea title').fill(uniqueTitle)
  await page.getByLabel('Submitter name').fill('Playwright Tester')
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 2 -- Process Mapping
  await expect(
    page.getByRole('heading', { name: 'Process Mapping' }),
  ).toBeVisible()
  await page.getByLabel('L1 — Category').selectOption({ index: 1 })
  await page.getByLabel('L2 — Process Group').selectOption({ index: 1 })
  await page.getByLabel('L3 — Process').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 3 -- Process Overview & Business Goals
  await expect(
    page.getByRole('heading', { name: 'Process Overview & Business Goals' }),
  ).toBeVisible()
  await page.getByLabel('Primary goal').selectOption('Cost Reduction')
  await page
    .getByLabel('Process stability (next 6 months)')
    .selectOption('No Change')
  await page
    .getByLabel('System stability (next 6 months)')
    .selectOption('No Change')
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 4 -- Volumetry & Human Effort
  await expect(
    page.getByRole('heading', { name: 'Volumetry & Human Effort' }),
  ).toBeVisible()
  await page.getByLabel('Task frequency').selectOption('Daily')
  await page.getByLabel('Transaction volume per cycle').fill('100')
  await page.getByLabel('Headcount in FTEs').fill('2')
  await page.getByLabel('Avg. time per task (minutes)').fill('10')
  await page.getByLabel('Error rate (%)').fill('5')
  await page.getByLabel('Avg. rework time (minutes)').fill('15')
  await page.getByLabel('Audit rate (%)').fill('2')
  await page.getByLabel('Avg. loaded FTE cost per year (EUR)').fill('40000')
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 5 -- Complexity & Standardisation
  await expect(
    page.getByRole('heading', { name: 'Complexity & Standardisation' }),
  ).toBeVisible()
  await page.getByLabel('Number of steps').selectOption('6-15')
  await page.getByLabel('Decision logic').selectOption('100% Rule-Based')
  await page.getByLabel('Process variations').selectOption('1 Standard Path')
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 6 -- Systems & Environment
  await expect(
    page.getByRole('heading', { name: 'Systems & Environment' }),
  ).toBeVisible()
  await page
    .getByLabel('Primary input format')
    .selectOption('Structured Digital (Excel/DB/API)')
  await page.getByLabel('Number of systems').selectOption('1')
  await page.getByLabel('System interface').selectOption('API Available')
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 7 -- AI Assessment
  await expect(
    page.getByRole('heading', { name: 'AI Assessment' }),
  ).toBeVisible()
  await page
    .getByLabel('Unstructured data')
    .selectOption('No (Tabular/Structured)')
  await page
    .getByLabel('Cognitive reasoning required')
    .selectOption('No (Strict If/Then)')
  await page.getByLabel('Computer vision / OCR').selectOption('No')
  await page
    .getByLabel('AI output risk tolerance')
    .selectOption('Strict 0% Tolerance')
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 8 -- Review & Submit
  await expect(
    page.getByRole('heading', { name: 'Review & Submit' }),
  ).toBeVisible()
  await expect(page.getByText(uniqueTitle)).toBeVisible()
  await page.getByRole('button', { name: 'Submit idea' }).click()

  // Redirect back to the pipeline with the new idea visible
  await expect(
    page.getByRole('heading', { name: 'Idea Pipeline' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)

  // Detail view
  await page.getByRole('heading', { name: uniqueTitle }).click()
  await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible()
  await expect(page.getByText('Quick Win')).toBeVisible()
})
