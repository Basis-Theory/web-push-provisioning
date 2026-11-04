import { BasisTheoryPushProvisioning, resolveVisaSdkUrl } from '~src/index';

describe('resolveVisaSdkUrl', () => {
  it('defaults to the sandbox script', () => {
    expect(resolveVisaSdkUrl({ appId: 'app 1' })).toBe(
      'https://sbx.digitalcardservice.com/web-sdk/V1/web_sdk.js?appId=app%201'
    );
  });

  it('selects the production script', () => {
    expect(resolveVisaSdkUrl({ appId: 'app', environment: 'production' })).toBe(
      'https://js.digitalcardservice.com/web-sdk/V1/web_sdk.js?appId=app'
    );
  });

  it('selects the mock without requiring an app id', () => {
    expect(resolveVisaSdkUrl({ environment: 'mock' })).toBe(
      'https://cdn.flock-dev.com/javascript/push-provisioning/mock/web_sdk.js'
    );
  });

  it('allows a custom script url', () => {
    expect(
      resolveVisaSdkUrl({
        appId: 'app',
        visaSdkUrl: 'http://localhost:4000/sdk.js',
      })
    ).toBe('http://localhost:4000/sdk.js?appId=app');
    expect(
      resolveVisaSdkUrl({ visaSdkUrl: 'http://localhost:4000/sdk.js' })
    ).toBe('http://localhost:4000/sdk.js');
  });

  it('requires an app id for the Visa-hosted scripts', () => {
    expect(() => resolveVisaSdkUrl({ environment: 'production' })).toThrow(
      'appId is required for the production environment'
    );
  });

  it('rejects unknown environments', () => {
    expect(() =>
      resolveVisaSdkUrl({ appId: 'app', environment: 'staging' as never })
    ).toThrow('Unknown environment staging');
  });
});

describe('BasisTheoryPushProvisioning', () => {
  it('exposes the configured environment and the client surface', () => {
    const sdk = BasisTheoryPushProvisioning('key_test', {
      environment: 'production',
      appId: 'app',
      disableTelemetry: true,
    });

    expect(sdk.environment).toBe('production');
    expect(typeof sdk.loadVisaSdk).toBe('function');
    expect(typeof sdk.getSupportedWallets).toBe('function');
    expect(typeof sdk.logout).toBe('function');
    expect(window.BasisTheoryPushProvisioning).toBe(
      BasisTheoryPushProvisioning
    );
  });

  it('rejects an empty api key', () => {
    expect(() => BasisTheoryPushProvisioning('')).toThrow('Missing api key');
  });

  it('fails the script load when the app id is missing', async () => {
    const sdk = BasisTheoryPushProvisioning('key_test', {
      disableTelemetry: true,
    });

    await expect(sdk.loadVisaSdk()).rejects.toThrow('appId is required');
  });
});
