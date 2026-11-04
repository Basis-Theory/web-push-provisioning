import { ENVIRONMENTS, Environment, VISA_SDK_BASE_URLS } from '~src/constants';
import {
  VisaWebSdkFactory,
  createVisaSdkAdapter,
  loadVisaSdkFactory,
} from '~src/handlers/visaSdk';
import { createRequestEncryptedCardPayload } from '~src/session';
import { createHttpClient, resolveApiBaseUrlOverride } from '~src/utils/http';
import { createLogger } from '~src/utils/logging';
import { createWalletFlow } from '~src/wallets';

declare global {
  interface Window {
    BasisTheoryPushProvisioning?: typeof BasisTheoryPushProvisioning;
  }
}

export type ConfigOptions = {
  /**
   * Selects the Visa script: `sandbox` (default), `production`, or `mock`
   * (the Basis Theory mock served from the dev CDN for dev and UAT tenants).
   */
  environment?: Environment;
  /**
   * Visa AppID issued for the tenant. Required for `sandbox` and
   * `production`; the mock ignores it.
   */
  appId?: string;
  /**
   * Overrides the Basis Theory API host. Takes precedence over `region`.
   */
  apiBaseUrl?: string;
  /**
   * Selects a regional API host: `us` or `eu`.
   */
  region?: string;
  /**
   * Overrides the Visa script URL, for example to load a local mock.
   */
  visaSdkUrl?: string;
  /**
   * Disables SDK telemetry.
   */
  disableTelemetry?: boolean;
};

export const resolveVisaSdkUrl = (
  options?: Pick<ConfigOptions, 'environment' | 'visaSdkUrl' | 'appId'>
): string => {
  const environment = options?.environment ?? 'sandbox';

  if (!ENVIRONMENTS.includes(environment)) {
    throw new Error(`Unknown environment ${String(environment)}`);
  }

  const base = options?.visaSdkUrl ?? VISA_SDK_BASE_URLS[environment];
  const appId = options?.appId;

  if (!appId) {
    if (environment === 'mock' || options?.visaSdkUrl) {
      return base;
    }

    throw new Error(`appId is required for the ${environment} environment`);
  }

  return `${base}?appId=${encodeURIComponent(appId)}`;
};

/**
 * Creates a push provisioning client. `apiKey` must be a Basis Theory
 * session key or public key; private keys must never be used in the browser.
 */
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
  const scriptOptions = { ...configOptions, environment };

  let factory: Promise<VisaWebSdkFactory> | undefined;

  const loadVisaSdk = (): Promise<VisaWebSdkFactory> => {
    factory ??= Promise.resolve()
      .then(() => loadVisaSdkFactory(resolveVisaSdkUrl(scriptOptions)))
      .catch((error: Error) => {
        factory = undefined;
        throw error;
      });

    return factory;
  };

  const flow = createWalletFlow({
    getAdapter: () =>
      loadVisaSdk().then((loaded) =>
        createVisaSdkAdapter(loaded, (error) => {
          void logger.log.warn(
            `Visa web SDK error: ${error?.message ?? 'unknown'}`,
            {
              code: String((error as { code?: string })?.code ?? ''),
            }
          );
        })
      ),
    requestEncryptedCardPayload: createRequestEncryptedCardPayload(http),
    logger,
  });

  return {
    environment,
    /**
     * Injects the Visa script ahead of time. `getSupportedWallets` loads it on
     * demand, so this is optional.
     */
    loadVisaSdk,
    /**
     * Starts a Visa session for the card token and returns the wallets the
     * card can be added to, with a handler per wallet.
     */
    getSupportedWallets: flow.getSupportedWallets,
    /**
     * Ends the Visa session. Called automatically after a wallet reports its
     * result and when the page is hidden or unloaded.
     */
    logout: flow.logout,
  };
};

if (typeof window !== 'undefined') {
  window.BasisTheoryPushProvisioning = BasisTheoryPushProvisioning;
}

export { BasisTheoryPushProvisioning };
export type BasisTheoryPushProvisioningClient = ReturnType<
  typeof BasisTheoryPushProvisioning
>;
export {
  DEFAULT_BUTTON_IDS,
  PROVISIONING_PARTIAL_CODES,
  PROVISIONING_SUCCESS_CODES,
  VISA_SDK_CONTAINER_ID,
  VISA_SDK_MOCK_URL,
  WALLETS,
} from '~src/constants';
export type { Environment, Wallet } from '~src/constants';
export type {
  ProvisioningResult,
  ProvisioningStatus,
} from '~src/handlers/results';
export type {
  VisaProvisioningResult,
  VisaSdkAdapter,
  VisaSupportedWallet,
  VisaWalletSetup,
  VisaWalletSetupOptions,
  VisaWebSdk,
  VisaWebSdkFactory,
} from '~src/handlers/visaSdk';
export type {
  EncryptedCardPayloadRequest,
  EncryptedCardPayloadResponse,
} from '~src/session';
export type {
  BasisTheoryPushProvisioningError,
  VisaSdkError,
} from '~src/utils/errors';
export type {
  AppleWalletHandler,
  GoogleWalletHandler,
  GoogleWalletHandlerOptions,
  SupportedWallet,
  SupportedWalletsOptions,
  SupportedWalletsResponse,
  WalletHandlerOptions,
  WalletStatus,
} from '~src/wallets';
