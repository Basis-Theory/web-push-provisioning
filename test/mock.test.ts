import { createHmac, timingSafeEqual, webcrypto } from 'crypto';
import { TextEncoder } from 'util';

type ProvisioningResult = Record<string, unknown>;
type WalletSetup = {
  wallet: string;
  options: {
    buttonId: string;
    provisioningResultCallback: (result: ProvisioningResult) => void;
  };
};
type MockSdk = {
  render: (containerId: string) => Promise<{ coreWebSDKLoaded: boolean }>;
  initialize: () => Promise<{ encNonce: string }>;
  logout: () => Promise<void>;
  getCorrelationId: () => string;
  pushProvisioningSdk: {
    SUPPORTED_WALLETS: Record<string, string>;
    getSupportedWallets: (payload: string) => Promise<unknown[]>;
    setupPushProvisionSDK: (
      payload: string,
      wallets: WalletSetup[]
    ) => Promise<unknown>;
  };
};
type MockFactory = ((options?: { onError?: (e: Error) => void }) => MockSdk) & {
  mock: { configure: (c: object) => void; reset: () => void };
};

const secret = 'test-signature-secret';

// Port of vault-api VisaPayloadCrypto.VerifyNonce.
const verifyNonce = (encNonce: string, key: string, now = Date.now()) => {
  const [header, payload, signature] = encNonce.split('.');
  const parsed = JSON.parse(
    Buffer.from(header, 'base64url').toString('utf8')
  ) as { alg: string; iat: number; exp: number };
  if (parsed.alg !== 'HS256') {
    return 'Unsigned';
  }
  const expected = createHmac('sha256', Buffer.from(key, 'utf8'))
    .update(`${header}.${payload}`, 'ascii')
    .digest();
  const actual = Buffer.from(signature, 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return 'InvalidSignature';
  }
  if (now < parsed.iat) {
    return 'NotYetActive';
  }
  if (now >= parsed.exp) {
    return 'Expired';
  }
  return Buffer.from(payload, 'base64url').toString('utf8');
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const expectCode = async (promise: Promise<unknown>, code: string) =>
  expect(promise).rejects.toMatchObject({ code });

describe('mock Visa web SDK', () => {
  let WebSDK: MockFactory;

  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'TextEncoder', {
      value: TextEncoder,
      configurable: true,
    });
    require('../examples/mock/web_sdk');
    WebSDK = (window as unknown as { WebSDK: MockFactory }).WebSDK;
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="web_sdk_container_id"></div>
      <button id="add-to-apple-wallet-button"></button>
      <button id="add-to-google-wallet-button"></button>`;
    WebSDK.mock.reset();
    WebSDK.mock.configure({ signatureSecret: secret });
  });

  const start = async (options?: { onError?: (e: Error) => void }) => {
    const sdk = WebSDK(options);
    await sdk.render('web_sdk_container_id');
    const { encNonce } = await sdk.initialize();
    return { sdk, encNonce };
  };

  const walletSetup = (
    wallet: string,
    buttonId: string,
    results: ProvisioningResult[]
  ): WalletSetup => ({
    wallet,
    options: {
      buttonId,
      provisioningResultCallback: (result) => results.push(result),
    },
  });

  it('exposes the method inventory of the live bundle', () => {
    const sdk = WebSDK();

    expect(Object.keys(sdk).sort()).toEqual([
      'getCorrelationId',
      'initialize',
      'logout',
      'pushProvisioningSdk',
      'render',
      'setCorrelationId',
      'setLocale',
    ]);
    expect(Object.keys(sdk.pushProvisioningSdk).sort()).toEqual([
      'SUPPORTED_WALLETS',
      'getPushProvisioningUX',
      'getSupportedWallets',
      'setupPushProvisionSDK',
    ]);
    expect(sdk.pushProvisioningSdk.SUPPORTED_WALLETS).toEqual({
      APPLE: 'APPLE',
      GOOGLE: 'GOOGLE',
    });
  });

  it('issues a nonce the payload API verifies with the signature secret', async () => {
    const { encNonce } = await start();
    const header = JSON.parse(
      Buffer.from(encNonce.split('.')[0], 'base64url').toString('utf8')
    ) as { iat: number; exp: number };

    expect(verifyNonce(encNonce, secret)).toMatch(/^[0-9a-f]{32}$/u);
    expect(verifyNonce(encNonce, 'another-secret')).toBe('InvalidSignature');
    expect(header.exp - header.iat).toBe(5 * 60 * 1000);
  });

  it('returns the documented wallets and delivers provisioning results on click', async () => {
    const { sdk } = await start();
    const results: ProvisioningResult[] = [];

    const wallets =
      await sdk.pushProvisioningSdk.getSupportedWallets('payload');
    await sdk.pushProvisioningSdk.setupPushProvisionSDK('payload', [
      walletSetup('APPLE', 'add-to-apple-wallet-button', results),
      walletSetup('GOOGLE', 'add-to-google-wallet-button', results),
    ]);
    document.getElementById('add-to-apple-wallet-button')!.click();
    document.getElementById('add-to-google-wallet-button')!.click();
    await tick();

    expect(wallets).toEqual([
      { walletName: 'APPLE', walletLogo: '', walletStatus: 'ELIGIBLE' },
      {
        walletName: 'GOOGLE',
        walletLogo: expect.stringContaining('pay.google.com') as string,
        walletStatus: 'ELIGIBLE',
      },
    ]);
    expect(results).toEqual([
      {
        wallet: 'APPLE',
        code: 'VPPW_1200',
        message: expect.any(String) as string,
        correlationId: sdk.getCorrelationId(),
      },
      {
        wallet: 'GOOGLE',
        code: 'VPPW_2002',
        message: expect.any(String) as string,
        correlationId: sdk.getCorrelationId(),
      },
    ]);
  });

  it('delivers a configured error result with a correlation id', async () => {
    WebSDK.mock.configure({
      results: {
        GOOGLE: { error: { code: 'VPPW_ERROR_2007', message: 'Declined' } },
      },
    });
    const { sdk } = await start();
    const results: ProvisioningResult[] = [];

    await sdk.pushProvisioningSdk.setupPushProvisionSDK('payload', [
      walletSetup('GOOGLE', 'add-to-google-wallet-button', results),
    ]);
    document.getElementById('add-to-google-wallet-button')!.click();
    await tick();

    expect(results).toEqual([
      {
        wallet: 'GOOGLE',
        error: {
          code: 'VPPW_ERROR_2007',
          message: 'Declined',
          correlationId: sdk.getCorrelationId(),
        },
      },
    ]);
  });

  it('simulates the documented failure modes', async () => {
    WebSDK.mock.configure({ scenario: 'expired-nonce' });
    const expired = await start();
    expect(verifyNonce(expired.encNonce, secret)).toBe('Expired');
    await expectCode(
      expired.sdk.pushProvisioningSdk.getSupportedWallets('payload'),
      'VDC_ERROR_403'
    );

    WebSDK.mock.configure({ scenario: 'lockout' });
    const locked = WebSDK();
    await locked.render('web_sdk_container_id');
    await expectCode(locked.initialize(), 'VDC_ERROR_409');

    WebSDK.mock.configure({ scenario: 'no-wallets' });
    const empty = await start();
    await expectCode(
      empty.sdk.pushProvisioningSdk.getSupportedWallets('payload'),
      'VPPW_ERROR_004'
    );

    WebSDK.mock.configure({ scenario: 'success' });
    const unbound = await start();
    await expectCode(
      unbound.sdk.pushProvisioningSdk.setupPushProvisionSDK('payload', [
        walletSetup('APPLE', 'no-such-button', []),
      ]),
      'VPPW_ERROR_002'
    );
  });

  it('rejects wallet calls outside a session and reports errors to onError', async () => {
    const seen: Error[] = [];
    const sdk = WebSDK({ onError: (error) => seen.push(error) });

    await expectCode(
      sdk.pushProvisioningSdk.getSupportedWallets('payload'),
      'VW_ERROR_427'
    );
    await sdk.render('web_sdk_container_id');
    await sdk.initialize();
    await sdk.logout();
    await expectCode(
      sdk.pushProvisioningSdk.getSupportedWallets('payload'),
      'VW_ERROR_427'
    );

    expect(
      seen.map((error) => (error as Error & { code: string }).code)
    ).toEqual(['VW_ERROR_427', 'VW_ERROR_427']);
  });
});
