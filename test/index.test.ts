import { BasisTheoryPushProvisioning, resolveVisaSdkUrl } from '~src/index';

describe('resolveVisaSdkUrl', () => {
  it('defaults to the sandbox script', () => {
    expect(resolveVisaSdkUrl('app 1')).toBe(
      'https://sbx.digitalcardservice.com/web-sdk/V1/web_sdk.js?appId=app%201'
    );
  });

  it('selects the production script', () => {
    expect(resolveVisaSdkUrl('app', { environment: 'production' })).toBe(
      'https://js.digitalcardservice.com/web-sdk/V1/web_sdk.js?appId=app'
    );
  });

  it('allows a custom script url for mocks', () => {
    expect(
      resolveVisaSdkUrl('app', { visaSdkUrl: 'http://localhost:4000/sdk.js' })
    ).toBe('http://localhost:4000/sdk.js?appId=app');
  });

  it('rejects unknown environments', () => {
    expect(() =>
      resolveVisaSdkUrl('app', { environment: 'staging' as never })
    ).toThrow('Unknown environment staging');
  });
});

describe('BasisTheoryPushProvisioning', () => {
  it('exposes the configured environment and the client surface', () => {
    const sdk = BasisTheoryPushProvisioning('key_test', {
      environment: 'production',
      disableTelemetry: true,
    });

    expect(sdk.environment).toBe('production');
    expect(typeof sdk.loadVisaSdk).toBe('function');
    expect(typeof sdk.requestEncryptedCardPayload).toBe('function');
    expect(window.BasisTheoryPushProvisioning).toBe(
      BasisTheoryPushProvisioning
    );
  });

  it('keeps credentials isolated between instances', async () => {
    const fetchMock = jest
      .fn<Promise<Response>, [string, RequestInit]>()
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ encrypted_card_payload: 'p' }),
      } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const first = BasisTheoryPushProvisioning('key_first', {
      apiBaseUrl: 'https://first.example',
      disableTelemetry: true,
    });
    const second = BasisTheoryPushProvisioning('key_second', {
      apiBaseUrl: 'https://second.example',
      disableTelemetry: true,
    });

    await first.requestEncryptedCardPayload({ nonce: 'n', tokenId: 't' });
    await second.requestEncryptedCardPayload({ nonce: 'n', tokenId: 't' });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://first.example/push-provisioning'
    );
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      'BT-API-KEY': 'key_first',
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://second.example/push-provisioning'
    );
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({
      'BT-API-KEY': 'key_second',
    });
  });
});
