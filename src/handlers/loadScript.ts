const DEFAULT_TIMEOUT_MS = 30_000;

export type LoadScriptOptions = {
  globalName: string;
  timeoutMs?: number;
};

export const loadScript = (
  url: string,
  { globalName, timeoutMs = DEFAULT_TIMEOUT_MS }: LoadScriptOptions
): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const existing = (window as unknown as Record<string, unknown>)[globalName];
    if (existing !== undefined) {
      resolve(existing);
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;

    const timeout = setTimeout(() => {
      script.remove();
      reject(new Error(`Timed out loading ${url}`));
    }, timeoutMs);

    const settle = () => {
      const loaded = (window as unknown as Record<string, unknown>)[globalName];
      if (loaded === undefined) {
        return false;
      }

      clearTimeout(timeout);
      resolve(loaded);
      return true;
    };

    script.addEventListener('load', () => {
      if (!settle()) {
        clearTimeout(timeout);
        reject(new Error(`${url} loaded but did not define ${globalName}`));
      }
    });

    script.addEventListener('error', () => {
      clearTimeout(timeout);
      script.remove();
      reject(new Error(`Failed to load ${url}`));
    });

    document.head.appendChild(script);
  });
