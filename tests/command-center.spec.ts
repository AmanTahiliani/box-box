import { test, expect } from '@playwright/test'

const FULL_SESSION = 9472

test.describe('Command Center', () => {
  test('loads as default route with weekend identity band', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('command-center')).toBeVisible()
    await expect(page.getByTestId('cc-focus')).toBeVisible()
    await expect(page.getByTestId('cc-session-9472')).toBeVisible()
    await expect(page.getByTestId('hero-last-race-link')).toBeVisible()
  })

  test('nav link reaches command center from race hub', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await page.getByRole('link', { name: 'Command' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('command-center')).toBeVisible()
  })

  test('open analysis action opens race hub for the focus session', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('hero-last-race-link')).toBeVisible()
    await page.getByTestId('hero-last-race-link').click()
    await expect(page).toHaveURL(new RegExp(`/race-hub\\?session_key=${FULL_SESSION}`))
    await expect(page.getByTestId('rh-identity')).toBeVisible()
    await expect(page.getByTestId(`rh-session-${FULL_SESSION}`)).toBeVisible()
  })

  test('archived live snapshot does not mark command center live', async ({ page }) => {
    await page.route('**/api/v1/live/state', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          is_live: false,
          data: null,
          last_snapshot: {
            Drivers: { '1': { RacingNumber: '1', Position: 1 } },
            DriverInfo: { '1': { RacingNumber: '1', Tla: 'VER', TeamColour: '3671C6' } },
            Tyres: {},
            RCMessages: [],
            Weather: {},
            Session: { MeetingName: 'Archived GP', SessionName: 'Race', SessionType: 'Race' },
            TeamRadio: [],
            SessionStatus: 'Finished',
            TrackStatus: '1',
            CurrentLap: 57,
            TotalLaps: 57,
            Clock: '',
            ClockRefTime: '',
            ClockExtrapolating: false,
            Stints: {},
          },
          last_snapshot_at: '2026-07-04T14:00:00Z',
        }),
      }),
    )

    await page.goto('/')
    await expect(page.getByTestId('command-center')).toBeVisible()
    await expect(page.getByTestId('cc-live-status')).toContainText('No live session')
    await expect(page.getByTestId('cc-live-status')).not.toContainText('Live session active')
  })

  test('existing routes continue to work', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await expect(page.getByTestId('race-hub')).toBeVisible()
    await expect(page.getByTestId('rh-overview')).toBeVisible()

    await page.goto('/admin')
    await expect(page.getByTestId('data-library')).toBeVisible()

    await page.goto('/live')
    await expect(page.getByTestId('live-empty')).toBeVisible()
  })
})
