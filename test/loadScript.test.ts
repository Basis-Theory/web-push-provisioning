import { loadScript } from '~src/handlers/loadScript';

const scripts = () =>
  Array.from(document.head.querySelectorAll('script')).map((s) => s.src);

describe('loadScript', () => {
  const globalName = 'FakeSDK';
  const url = 'https://example.test/sdk.js?appId=abc';

  beforeEach(() => {
    document.head.innerHTML = '';
    delete (window as unknown as Record<string, unknown>)[globalName];
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('injects the script once and resolves with the global it defines', async () => {
    const pending = loadScript(url, { globalName });
    expect(scripts()).toEqual([url]);

    (window as unknown as Record<string, unknown>)[globalName] = {
      ready: true,
    };
    document.head.querySelector('script')!.dispatchEvent(new Event('load'));

    await expect(pending).resolves.toEqual({ ready: true });
  });

  it('resolves immediately when the global already exists', async () => {
    (window as unknown as Record<string, unknown>)[globalName] = 'loaded';

    await expect(loadScript(url, { globalName })).resolves.toBe('loaded');
    expect(scripts()).toEqual([]);
  });

  it('rejects when the script loads without defining the global', async () => {
    const pending = loadScript(url, { globalName });
    document.head.querySelector('script')!.dispatchEvent(new Event('load'));

    await expect(pending).rejects.toThrow(`did not define ${globalName}`);
  });

  it('rejects and removes the tag on a load error', async () => {
    const pending = loadScript(url, { globalName });
    document.head.querySelector('script')!.dispatchEvent(new Event('error'));

    await expect(pending).rejects.toThrow(`Failed to load ${url}`);
    expect(scripts()).toEqual([]);
  });

  it('rejects after the timeout', async () => {
    const pending = loadScript(url, { globalName, timeoutMs: 1000 });
    jest.advanceTimersByTime(1000);

    await expect(pending).rejects.toThrow(`Timed out loading ${url}`);
    expect(scripts()).toEqual([]);
  });
});
