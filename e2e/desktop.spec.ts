import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'node:process'
import { _electron as electron, expect, test } from '@playwright/test'

test('first-run discovery, triage, provider setup, and analysis', async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'therss-e2e-'))
  const application = await electron.launch({
    args: [`--user-data-dir=${userDataDirectory}`, '.'],
    env: { ...env, THERSS_E2E_FIXTURES: '1' }
  })

  try {
    const page = await application.firstWindow()
    const rendererErrors: string[] = []
    page.on('pageerror', (error) => rendererErrors.push(error.message))
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    expect(rendererErrors).toEqual([])
    expect(page.url()).toContain('/out/renderer/index.html')
    await expect(page.getByRole('heading', { name: 'Build your research radar' })).toBeVisible()

    await page.getByRole('button', { name: 'Set research interests' }).click()
    await page.getByRole('textbox', { name: 'Profile name' }).fill('E2E research')
    await page.getByRole('textbox', { name: 'arXiv categories' }).fill('cs.LG')
    await page.getByRole('textbox', { name: 'arXiv keywords' }).fill('structured pruning')
    await page.getByRole('textbox', { name: 'GitHub topics' }).fill('model-compression')
    await page.getByRole('button', { name: 'Save research radar' }).click()

    await page.reload()
    await expect(page.getByText('Structured pruning for edge deployment')).toBeVisible()
    await expect(page.getByText('TheRSS/fixture')).toBeVisible()

    await page.getByRole('button', { name: '04 Models & Agents' }).click()
    await page.getByRole('textbox', { name: 'Provider name' }).fill('Local fixture')
    await page.getByRole('textbox', { name: 'Provider base URL' }).fill('http://127.0.0.1:11434/v1')
    await page.getByRole('textbox', { name: 'Model name' }).fill('fixture-model')
    await page.getByRole('button', { name: 'Save model provider' }).click()

    await page.getByRole('button', { name: '01 Today' }).click()
    const paperCard = page
      .locator('article')
      .filter({ hasText: 'Structured pruning for edge deployment' })
    await paperCard.getByRole('button', { name: 'Analyze signal' }).click()
    await expect(page.getByText(/E2E fixture analysis passed/)).toBeVisible()
    await expect(page.getByText('Local fixture · fixture-model')).toBeVisible()

    await paperCard.getByRole('button', { name: 'Save signal' }).click()
    await expect(paperCard.getByRole('button', { name: 'Saved' })).toBeDisabled()
  } finally {
    await application.close()
  }
})
