import { API_BASE_URL } from '~src/constants';
import { resolveApiBaseUrlOverride } from '~src/utils/http';

describe('resolveApiBaseUrlOverride', () => {
  it('returns no override when nothing is configured', () => {
    // `undefined` is how an unconfigured caller falls through to API_BASE_URL.
    // Returning the default host here instead would mark every default request
    // as using a custom URL.
    expect(resolveApiBaseUrlOverride()).toBeUndefined();
    expect(resolveApiBaseUrlOverride({})).toBeUndefined();
    expect(
      resolveApiBaseUrlOverride({ apiBaseUrl: undefined, region: undefined })
    ).toBeUndefined();
  });

  it('leaves the compatibility host as the effective default', () => {
    expect(API_BASE_URL).toBe('https://api.basistheory.com');
  });

  it.each([
    ['us', 'https://api.us.basistheory.com'],
    ['eu', 'https://api.eu.basistheory.com'],
    ['US', 'https://api.us.basistheory.com'],
    ['Eu', 'https://api.eu.basistheory.com'],
  ])('resolves the %s region', (region, expected) => {
    expect(resolveApiBaseUrlOverride({ region })).toBe(expected);
  });

  it('prefers an explicit apiBaseUrl over a region', () => {
    expect(
      resolveApiBaseUrlOverride({
        apiBaseUrl: 'https://api.flock-dev.com',
        region: 'eu',
      })
    ).toBe('https://api.flock-dev.com');
  });

  it.each(['apac', 'unknown', ''])(
    'returns no override for the unrecognized region %s',
    (region) => {
      expect(resolveApiBaseUrlOverride({ region })).toBeUndefined();
    }
  );
});
