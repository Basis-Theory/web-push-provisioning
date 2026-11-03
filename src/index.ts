import {
  ENVIRONMENTS,
  Environment,
  VISA_SDK_BASE_URLS,
  VISA_SDK_GLOBAL_NAME,
} from '~src/constants';
import { loadScript } from '~src/handlers/loadScript';
import { createRequestEncryptedCardPayload } from '~src/session';
import { createHttpClient, resolveApiBaseUrlOverride } from '~src/utils/http';
import { createLogger } from '~src/utils/logging';

declare global {
  interface Window {
    BasisTheoryPushProvisioning?: typeof BasisTheoryPushProvisioning;
  }
}

export type ConfigOptions = {
  environment?: Environment;
  apiBaseUrl?: string;
  region?: string;
  visaSdkUrl?: string;
  disableTelemetry?: boolean;
};

export const resolveVisaSdkUrl = (
  appId: string,
  options?: Pick<ConfigOptions, 'environment' | 'visaSdkUrl'>
): string => {
  const environment = options?.environment ?? 'sandbox';

  if (!ENVIRONMENTS.includes(environment)) {
    throw new Error(`Unknown environment ${String(environment)}`);
  }

  const base = options?.visaSdkUrl ?? VISA_SDK_BASE_URLS[environment];

  return `${base}?appId=${encodeURIComponent(appId)}`;
};

const BasisTheoryPushProvisioning = (
  apiKey: string,
  configOptions?: ConfigOptions
) => {
  const logger = createLogger({
    disableTelemetry: configOptions?.disableTelemetry ?? false,
  });

  const http = createHttpClient(
    apiKey,
    logger,
    resolveApiBaseUrlOverride(configOptions)
  );

  const environment: Environment = configOptions?.environment ?? 'sandbox';

  return {
    environment,
    loadVisaSdk: (appId: string) =>
      loadScript(resolveVisaSdkUrl(appId, { ...configOptions, environment }), {
        globalName: VISA_SDK_GLOBAL_NAME,
      }),
    requestEncryptedCardPayload: createRequestEncryptedCardPayload(http),
  };
};

if (typeof window !== 'undefined') {
  window.BasisTheoryPushProvisioning = BasisTheoryPushProvisioning;
}

export { BasisTheoryPushProvisioning };
export { VISA_SDK_MOCK_URLS } from '~src/constants';
export type { Environment } from '~src/constants';
export type {
  EncryptedCardPayloadRequest,
  EncryptedCardPayloadResponse,
} from '~src/session';
export type { BasisTheoryPushProvisioningError } from '~src/utils/errors';
