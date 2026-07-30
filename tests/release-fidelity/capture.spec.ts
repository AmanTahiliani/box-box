import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test, type Page } from '@playwright/test'
import {
  gotoCommandCenterReady,
  gotoLiveEmptyReady,
} from '../visual/helpers'

const version = process.env.RELEASE_FIDELITY_VERSION ?? 'v0.4.0'
const output = process.env.RELEASE_FIDELITY_OUTPUT ?? 'release-fidelity'

async function capture(page: Page, name: string, project: string): Promise<void> {
  const directory = join(output, version, 'candidate', project)
  await mkdir(directory, { recursive: true })
  await page.screenshot({ fullPage: true, path: join(directory, `${name}.png`) })
}

test.describe('release-fidelity candidate captures', () => {
  test('approved screen set', async ({ page }, testInfo) => {
    const project = testInfo.project.name

    if (project === 'desktop') {
      await gotoCommandCenterReady(page)
      await capture(page, 'weekend-between-races', project)
      await gotoLiveEmptyReady(page)
      await capture(page, 'weekend-live', project)
    } else {
      await gotoCommandCenterReady(page)
      await capture(page, 'weekend-between-sessions-mobile', project)
    }
  })
})
