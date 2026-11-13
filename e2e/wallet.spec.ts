import { expect, test, type Page } from '@playwright/test';

const apple = (page: Page) => page.locator('#add-to-apple-wallet-button');
const google = (page: Page) => page.locator('#add-to-google-wallet-button');

const postTo = (page: Page, pathname: string) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === pathname
  );

test.beforeEach(async ({ page }) => {
  await page.route('https://http-intake.logs.datadoghq.com/**', (route) =>
    route.fulfill({ status: 200 })
  );
});

test('provisions a card through a session, the payload API and the mock', async ({
  page,
}) => {
  const session = postTo(page, '/sessions');
  const payload = postTo(page, '/push-provisioning');

  await page.goto('/');
  await expect(apple(page)).toBeDisabled();
  await expect(google(page)).toBeDisabled();

  await page.getByRole('button', { name: 'Sign in' }).click();

  expect((await session).status()).toBe(201);

  const payloadResponse = await payload;
  expect(payloadResponse.status(), await payloadResponse.text()).toBe(200);
  expect(
    ((await payloadResponse.json()) as { encrypted_card_payload: string })
      .encrypted_card_payload
  ).toMatch(/^[\w-]+(\.[\w-]+)+$/u);

  await expect(page.locator('#apple-wallet-status')).toHaveText('ELIGIBLE');
  await expect(page.locator('#google-wallet-status')).toHaveText('ELIGIBLE');
  await expect(page.locator('#web_sdk_container_id')).not.toBeEmpty();

  await apple(page).click();

  await expect(page.locator('body')).toHaveAttribute('data-state', 'success');
  await expect(page.locator('#result-message')).toHaveText(
    'Card added to Apple Wallet.'
  );
  await expect(page.locator('#result-code')).toHaveText('VPPW_1200');
  await expect(page.locator('#result-correlation-id')).toHaveText(/_VMCP$/u);
});

test('shows a failed wallet result and recovers on retry', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).WebSDKMockConfig = {
      results: {
        GOOGLE: {
          error: { code: 'VPPW_ERROR_2007', message: 'Provisioning failed' },
        },
      },
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await google(page).click();

  await expect(page.locator('body')).toHaveAttribute('data-state', 'failed');
  await expect(page.locator('#result-message')).toHaveText(
    'The card could not be added to Google Wallet.'
  );
  await expect(page.locator('#result-code')).toHaveText('VPPW_ERROR_2007');

  await page.getByRole('button', { name: 'Try again' }).click();

  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await expect(google(page)).toBeEnabled();
});
