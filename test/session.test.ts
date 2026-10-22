import { http } from '~src/utils/http';
import { configureLogger } from '~src/utils/logging';
import { requestEncryptedCardPayload } from '~src/session';

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

describe('requestEncryptedCardPayload', () => {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    configureLogger({ disableTelemetry: true });
    http.init('key_test_123', 'https://api.flock-dev.com');
  });

  it('posts the nonce and token id in snake_case and maps the response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { encrypted_card_payload: 'header.payload.signature' })
    );

    const result = await requestEncryptedCardPayload({
      nonce: 'enc-nonce',
      tokenId: 'token-id',
      correlationId: 'corr-1',
    });

    expect(result).toEqual({
      encryptedCardPayload: 'header.payload.signature',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.flock-dev.com/push-provisioning');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      nonce: 'enc-nonce',
      token_id: 'token-id',
    });
    expect(init.headers).toMatchObject({
      'BT-API-KEY': 'key_test_123',
      'BT-TRACE-ID': 'corr-1',
    });
  });

  it('surfaces problem details from the API as a typed error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        title: 'One or more validation errors occurred.',
        status: 400,
        errors: { nonce: ["'nonce' is expired"] },
      })
    );

    await expect(
      requestEncryptedCardPayload({ nonce: 'old', tokenId: 'token-id' })
    ).rejects.toMatchObject({
      name: 'BasisTheoryPushProvisioningError',
      status: 400,
      errors: { nonce: ["'nonce' is expired"] },
    });
  });

  it('fails clearly when the API returns a non-problem error body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(502, {}));

    await expect(
      requestEncryptedCardPayload({ nonce: 'n', tokenId: 'token-id' })
    ).rejects.toThrow('Payload request failed with status 502');
  });
});
