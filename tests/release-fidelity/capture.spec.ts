import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import {
  gotoLiveEmptyReady,
  waitForScreenshotReady,
} from '../visual/helpers'

const version = process.env.RELEASE_FIDELITY_VERSION ?? 'v0.4.0'
const output = process.env.RELEASE_FIDELITY_OUTPUT ?? 'release-fidelity'

async function capture(page: Page, name: string, project: string): Promise<void> {
  const directory = join(output, version, 'candidate', project)
  await mkdir(directory, { recursive: true })
  await page.screenshot({ fullPage: true, path: join(directory, `${name}.png`) })
}

async function gotoCommandCenterFidelityReady(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('command-center')).toBeVisible()
  await expect(page.getByTestId('cc-focus')).toBeVisible()
  await expect(page.getByTestId('cc-calendar-1229')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await waitForScreenshotReady(page)
}

test.describe('release-fidelity candidate captures', () => {
  test('approved screen set', async ({ page }, testInfo) => {
    const project = testInfo.project.name

    if (project === 'desktop') {
      await gotoCommandCenterFidelityReady(page)
      await capture(page, 'weekend-between-races', project)
      await gotoLiveEmptyReady(page)
      await capture(page, 'weekend-live', project)
    } else {
      await gotoCommandCenterFidelityReady(page)
      await capture(page, 'weekend-between-sessions-mobile', project)
    }
  })
})
