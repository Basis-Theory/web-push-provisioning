import { PUSH_PROVISIONING_PATH } from '~src/constants';
import { isApiError, processApiError } from '~src/utils/errors';
import { http } from '~src/utils/http';

export type EncryptedCardPayloadRequest = {
  nonce: string;
  tokenId: string;
  correlationId?: string;
};

export type EncryptedCardPayloadResponse = {
  encryptedCardPayload: string;
};

export const requestEncryptedCardPayload = async ({
  nonce,
  tokenId,
  correlationId,
}: EncryptedCardPayloadRequest): Promise<EncryptedCardPayloadResponse> => {
  const response = await http.post(
    PUSH_PROVISIONING_PATH,
    { nonce, token_id: tokenId },
    correlationId
  );

  const body = (await response.json()) as unknown;

  if (!response.ok) {
    if (isApiError(body)) {
      processApiError(body);
    }

    throw new Error(`Payload request failed with status ${response.status}`);
  }

  const { encrypted_card_payload: encryptedCardPayload } = body as {
    encrypted_card_payload: string;
  };

  return { encryptedCardPayload };
};
