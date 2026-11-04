import { webcrypto } from 'crypto';
import { TextEncoder } from 'util';
import { BasisTheoryPushProvisioning, VISA_SDK_MOCK_URL } from '~src/index';
import type { VisaWebSdkFactory } from '~src/handlers/visaSdk';

type MockFactory = VisaWebSdkFactory & {
  mock: { configure: (c: object) => void; reset: () => void };
};

const secret = 'test-signature-secret';
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const payloadResponse = (encryptedCardPayload: string) =>
  ({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({ encrypted_card_payload: encryptedCardPayload }),
  }) as Response;

describe('wallet flow against the mock Visa web SDK', () => {
  let WebSDK: MockFactory;
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();

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

    // jsdom never executes injected scripts: register the mock's tag so the
    // loader finds the global already defined by the expected url.
    const tag = document.createElement('script');
    tag.src = VISA_SDK_MOCK_URL;
    document.head.appendChild(tag);
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="add-to-apple-wallet-button"></button>
      <button id="add-to-google-wallet-button"></button>
      <button id="custom-google-button"></button>`;
    WebSDK.mock.reset();
    WebSDK.mock.configure({ signatureSecret: secret });
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(payloadResponse('header.payload.signature'));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const client = () =>
    BasisTheoryPushProvisioning('key_test', {
      environment: 'mock',
      apiBaseUrl: 'https://api.flock-dev.com',
      disableTelemetry: true,
    });

  const click = async (id: string) => {
    document.getElementById(id)!.click();
    await tick();
  };

  // Wraps the mock factory so a test can observe the instance the wrapper
  // creates; restore() puts the real factory back.
  const captureSdk = () => {
    const real = WebSDK;
    const instances: ReturnType<VisaWebSdkFactory>[] = [];
    const capturing: VisaWebSdkFactory = (options) => {
      const sdk = real(options);
      instances.push(sdk);
      return sdk;
    };
    (window as unknown as { WebSDK: unknown }).WebSDK = capturing;

    return {
      instances,
      restore: () => {
        (window as unknown as { WebSDK: unknown }).WebSDK = real;
      },
    };
  };

  it('exchanges the nonce for a payload and returns both wallets with handlers', async () => {
    const bt = client();

    const { wallets, appleWallet, googleWallet } = await bt.getSupportedWallets(
      'token-1',
      { correlationId: 'corr-1' }
    );

    expect(wallets).toEqual([
      { name: 'APPLE', logoUrl: undefined, status: 'ELIGIBLE' },
      {
        name: 'GOOGLE',
        logoUrl: expect.stringContaining('pay.google.com') as string,
        status: 'ELIGIBLE',
      },
    ]);
    expect(typeof appleWallet).toBe('function');
    expect(typeof googleWallet).toBe('function');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.flock-dev.com/push-provisioning');
    const body = JSON.parse(init.body as string) as {
      nonce: string;
      token_id: string;
    };
    expect(body.token_id).toBe('token-1');
    expect(body.nonce.split('.')).toHaveLength(3);
    expect(init.headers).toMatchObject({ 'BT-TRACE-ID': 'corr-1' });
    expect(document.getElementById('web_sdk_container_id')).not.toBeNull();
  });

  it('resolves the Apple handler with a success result and logs out', async () => {
    const bt = client();
    const { appleWallet } = await bt.getSupportedWallets('token-1');

    const pending = appleWallet!();
    await click('add-to-apple-wallet-button');

    await expect(pending).resolves.toEqual({
      wallet: 'APPLE',
      success: true,
      status: 'success',
      code: 'VPPW_1200',
      message: expect.any(String) as string,
      correlationId: expect.stringMatching(/_VMCP$/u) as string,
    });

    // The session ended: setting up again needs a new getSupportedWallets.
    await expect(appleWallet!()).rejects.toThrow('session has ended');
  });

  it('keeps both buttons bound when both handlers are set up', async () => {
    const bt = client();
    const { appleWallet, googleWallet } = await bt.getSupportedWallets('t');

    const apple = appleWallet!();
    const google = googleWallet!({ buttonId: 'custom-google-button' });
    await tick();
    await click('custom-google-button');

    await expect(google).resolves.toMatchObject({
      wallet: 'GOOGLE',
      success: true,
      code: 'VPPW_2002',
    });
    // Apple's handler stays pending: its session is gone.
    let settled = false;
    void apple.finally(() => {
      settled = true;
    });
    await click('add-to-apple-wallet-button');
    expect(settled).toBe(false);
  });

  it('passes the Google options and button id to the Visa SDK', async () => {
    const captured = captureSdk();

    try {
      const { googleWallet } = await client().getSupportedWallets('t');
      const setups: unknown[] = [];
      const sdk = captured.instances[0].pushProvisioningSdk;
      const { setupPushProvisionSDK } = sdk;
      sdk.setupPushProvisionSDK = (payload, wallets) => {
        setups.push(wallets);
        return setupPushProvisionSDK(payload, wallets);
      };

      await expect(
        googleWallet!({
          provisionCardToGoogleAccount: false,
          provisionDeviceToken: false,
        })
      ).rejects.toThrow('At least one of');
      expect(setups).toEqual([]);

      void googleWallet!({
        buttonId: 'custom-google-button',
        provisionDeviceToken: false,
      });
      await tick();

      expect(setups).toEqual([
        [
          {
            wallet: 'GOOGLE',
            options: {
              buttonId: 'custom-google-button',
              provisionCardToGoogleAccount: true,
              provisionDeviceToken: false,
              provisioningResultCallback: expect.any(Function) as unknown,
            },
          },
        ],
      ]);
    } finally {
      captured.restore();
    }
  });

  it('logs out of Visa when the payload exchange fails after initialize', async () => {
    const captured = captureSdk();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({}),
    } as Response);

    try {
      const bt = client();
      await expect(bt.getSupportedWallets('t')).rejects.toThrow(
        'Payload request failed'
      );

      const sdk = captured.instances[0];
      await expect(
        sdk.pushProvisioningSdk.getSupportedWallets('payload')
      ).rejects.toMatchObject({ code: 'VW_ERROR_427' });

      fetchMock.mockResolvedValue(payloadResponse('p'));
      await expect(bt.getSupportedWallets('t')).resolves.toMatchObject({
        wallets: expect.any(Array) as unknown,
      });
    } finally {
      captured.restore();
    }
  });

  it('keeps the newer session when an older overlapping call fails', async () => {
    let failOlder: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        failOlder = resolve;
      })
    );
    const bt = client();

    const older = bt.getSupportedWallets('t');
    await tick();
    const newer = await bt.getSupportedWallets('t');

    failOlder({
      ok: false,
      status: 502,
      json: () => Promise.resolve({}),
    } as Response);
    await expect(older).rejects.toThrow('Payload request failed');

    const pending = newer.appleWallet!();
    await click('add-to-apple-wallet-button');
    await expect(pending).resolves.toMatchObject({ success: true });
  });

  it('rejects an older overlapping call that would otherwise win', async () => {
    let finishOlder: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finishOlder = resolve;
      })
    );
    const bt = client();

    const older = bt.getSupportedWallets('t');
    await tick();
    const newer = await bt.getSupportedWallets('t');
    finishOlder(payloadResponse('late'));

    await expect(older).rejects.toThrow('called again before');

    const pending = newer.googleWallet!();
    await click('add-to-google-wallet-button');
    await expect(pending).resolves.toMatchObject({ success: true });
  });

  it('maps a partial Google result', async () => {
    const bt = client();
    const { googleWallet } = await bt.getSupportedWallets('t');
    const results: unknown[] = [];
    WebSDK.mock.configure({
      results: {
        GOOGLE: { code: 'VPPW_2005', message: 'Added to account only' },
      },
    });

    const pending = googleWallet!({ provisionDeviceToken: false }).then((r) =>
      results.push(r)
    );
    await click('add-to-google-wallet-button');
    await pending;

    expect(results).toEqual([
      expect.objectContaining({
        wallet: 'GOOGLE',
        success: false,
        status: 'partial',
        code: 'VPPW_2005',
      }),
    ]);
  });

  it('resolves an error result from the wallet callback as a typed result', async () => {
    WebSDK.mock.configure({
      results: {
        APPLE: { error: { code: 'VPPW_ERROR_2007', message: 'Declined' } },
      },
    });
    const bt = client();
    const { appleWallet } = await bt.getSupportedWallets('t');

    const pending = appleWallet!();
    await click('add-to-apple-wallet-button');

    await expect(pending).resolves.toEqual({
      wallet: 'APPLE',
      success: false,
      status: 'error',
      code: 'VPPW_ERROR_2007',
      message: 'Declined',
      correlationId: expect.stringMatching(/_VMCP$/u) as string,
    });
  });

  it('rejects the handler with a Visa error when the button is missing', async () => {
    const bt = client();
    const { appleWallet } = await bt.getSupportedWallets('t');

    await expect(appleWallet!({ buttonId: 'nope' })).rejects.toMatchObject({
      name: 'VisaSdkError',
      code: 'VPPW_ERROR_002',
      correlationId: expect.stringMatching(/_VMCP$/u) as string,
    });
  });

  it.each([
    ['lockout', 'VDC_ERROR_409'],
    ['no-wallets', 'VPPW_ERROR_004'],
  ])('surfaces the %s scenario as a Visa error', async (scenario, code) => {
    WebSDK.mock.configure({ scenario });

    await expect(client().getSupportedWallets('t')).rejects.toMatchObject({
      name: 'VisaSdkError',
      code,
    });
  });

  it('surfaces payload API errors before calling Visa', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          title: 'One or more validation errors occurred.',
          status: 400,
          errors: { nonce: ["'nonce' is expired"] },
        }),
    } as Response);

    await expect(client().getSupportedWallets('t')).rejects.toMatchObject({
      name: 'BasisTheoryPushProvisioningError',
      status: 400,
    });
  });

  it('renders into a caller-provided container and rejects a missing one', async () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="mine"></div>');
    const bt = client();

    await bt.getSupportedWallets('t', { containerId: 'mine' });

    expect(document.querySelector('#mine data-provider')).not.toBeNull();
    expect(document.getElementById('web_sdk_container_id')).toBeNull();
    await expect(
      client().getSupportedWallets('t', { containerId: 'missing' })
    ).rejects.toThrow('Container element "missing" was not found');
  });

  it('logs out on page hide and on an explicit logout', async () => {
    const bt = client();
    const first = await bt.getSupportedWallets('t');
    window.dispatchEvent(new Event('pagehide'));
    await tick();

    await expect(first.appleWallet!()).rejects.toThrow('session has ended');

    const second = await bt.getSupportedWallets('t');
    await bt.logout();
    await expect(second.googleWallet!()).rejects.toThrow('session has ended');
  });

  it('omits the handler for a wallet Visa did not return', async () => {
    WebSDK.mock.configure({
      wallets: [
        { walletName: 'APPLE', walletLogo: '', walletStatus: 'ELIGIBLE' },
      ],
    });

    const { wallets, appleWallet, googleWallet } =
      await client().getSupportedWallets('t');

    expect(wallets.map((w) => w.name)).toEqual(['APPLE']);
    expect(appleWallet).toBeDefined();
    expect(googleWallet).toBeUndefined();
  });
});
