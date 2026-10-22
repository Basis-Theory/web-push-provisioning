import {
  ENVIRONMENTS,
  Environment,
  VISA_SDK_BASE_URLS,
  VISA_SDK_GLOBAL_NAME,
} from '~src/constants';
import { loadScript } from '~src/handlers/loadScript';
import { requestEncryptedCardPayload } from '~src/session';
import { http, resolveApiBaseUrlOverride } from '~src/utils/http';
import { configureLogger } from '~src/utils/logging';

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
  configureLogger({
    disableTelemetry: configOptions?.disableTelemetry ?? false,
  });

  http.init(apiKey, resolveApiBaseUrlOverride(configOptions));

  const environment: Environment = configOptions?.environment ?? 'sandbox';

  return {
    environment,
    loadVisaSdk: (appId: string) =>
      loadScript(resolveVisaSdkUrl(appId, { ...configOptions, environment }), {
        globalName: VISA_SDK_GLOBAL_NAME,
      }),
    requestEncryptedCardPayload,
  };
};

if (typeof window !== 'undefined') {
  window.BasisTheoryPushProvisioning = BasisTheoryPushProvisioning;
}

export { BasisTheoryPushProvisioning };
export type { Environment } from '~src/constants';
export type {
  EncryptedCardPayloadRequest,
  EncryptedCardPayloadResponse,
} from '~src/session';
export type { BasisTheoryPushProvisioningError } from '~src/utils/errors';
