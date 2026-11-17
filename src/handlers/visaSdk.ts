import { VISA_SDK_GLOBAL_NAME, Wallet } from '~src/constants';
import { loadScript } from '~src/handlers/loadScript';
import { toVisaSdkError } from '~src/utils/errors';

export type VisaSupportedWallet = {
  walletName: string;
  walletLogo?: string;
  walletStatus?: string;
};

export type VisaResultCode = {
  code?: string;
  message?: string;
};

export type VisaProvisioningError = VisaResultCode & {
  correlationId?: string;
  errorCodes?: VisaResultCode[];
};

export type VisaProvisioningOutcome = VisaResultCode & {
  correlationId?: string;
  resultCodes?: VisaResultCode[];
  nonFatalErrors?: VisaResultCode[];
};

/**
 * What Visa passes to `provisioningResultCallback`: exactly one of `result`
 * or `error`. Apple Wallet reports a single `code` and `message`; Google
 * Wallet reports arrays (`resultCodes`, `errorCodes`).
 */
export type VisaProvisioningResult = {
  result?: VisaProvisioningOutcome;
  error?: VisaProvisioningError;
};

export type VisaWalletSetupResult = VisaResultCode & {
  status?: 'SETUP_SUCCESS' | 'SETUP_FAILURE' | (string & {});
};

/**
 * Setting up a list of wallets always resolves, with one entry per wallet.
 */
export type VisaSetupResults = Partial<Record<Wallet, VisaWalletSetupResult>>;

export type VisaWalletSetupOptions = {
  buttonId: string;
  provisioningResultCallback: (result: VisaProvisioningResult) => void;
  provisionCardToGoogleAccount?: boolean;
  provisionDeviceToken?: boolean;
};

export type VisaWalletSetup = {
  wallet: Wallet;
  options: VisaWalletSetupOptions;
};

/**
 * Surface of the live Visa bundle the wrapper depends on. Push provisioning
 * methods live under `pushProvisioningSdk`, not at the top level as in the
 * draft guide.
 */
export type VisaWebSdk = {
  render: (containerId: string) => Promise<unknown>;
  setLocale?: (locale: string) => void;
  initialize: () => Promise<{ encNonce: string }>;
  logout: () => Promise<unknown>;
  getCorrelationId: () => string;
  pushProvisioningSdk: {
    SUPPORTED_WALLETS: Record<string, string>;
    getSupportedWallets: (
      encryptedCardPayload: string
    ) => Promise<VisaSupportedWallet[]>;
    setupPushProvisionSDK: (
      encryptedCardPayload: string,
      wallets: VisaWalletSetup[]
    ) => Promise<unknown>;
  };
};

export type VisaWebSdkFactory = (options?: {
  onError?: (error: Error) => void;
}) => VisaWebSdk;

/**
 * The seam between the wrapper and whichever script backs it: Visa's hosted
 * bundle or the mock. Nothing above this layer knows where the methods live
 * or how their failures are shaped.
 */
export type VisaSdkAdapter = {
  render: (containerId: string) => Promise<void>;
  setLocale: (locale: string) => void;
  initialize: () => Promise<string>;
  getSupportedWallets: (
    encryptedCardPayload: string
  ) => Promise<VisaSupportedWallet[]>;
  setupPushProvisioning: (
    encryptedCardPayload: string,
    wallets: VisaWalletSetup[]
  ) => Promise<VisaSetupResults>;
  logout: () => Promise<void>;
  getCorrelationId: () => string | undefined;
};

export const loadVisaSdkFactory = (url: string): Promise<VisaWebSdkFactory> =>
  loadScript(url, { globalName: VISA_SDK_GLOBAL_NAME }).then((global) => {
    if (typeof global !== 'function') {
      throw new Error(`${VISA_SDK_GLOBAL_NAME} is not a constructor`);
    }

    return global as VisaWebSdkFactory;
  });

const guard = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    throw toVisaSdkError(error);
  }
};

export const createVisaSdkAdapter = (
  factory: VisaWebSdkFactory,
  onError?: (error: Error) => void
): VisaSdkAdapter => {
  const sdk = factory({ onError });

  return {
    render: (containerId) =>
      guard(async () => {
        await sdk.render(containerId);
      }),
    setLocale: (locale) => sdk.setLocale?.(locale),
    initialize: () =>
      guard(async () => {
        const { encNonce } = await sdk.initialize();

        if (typeof encNonce !== 'string' || !encNonce) {
          throw new Error('The Visa web SDK did not return a nonce');
        }

        return encNonce;
      }),
    getSupportedWallets: (encryptedCardPayload) =>
      guard(async () => {
        const wallets =
          await sdk.pushProvisioningSdk.getSupportedWallets(
            encryptedCardPayload
          );

        return Array.isArray(wallets) ? wallets : [];
      }),
    setupPushProvisioning: (encryptedCardPayload, wallets) =>
      guard(async () => {
        const results = (await sdk.pushProvisioningSdk.setupPushProvisionSDK(
          encryptedCardPayload,
          wallets
        )) as
          (VisaSetupResults & { error?: VisaProvisioningError }) | undefined;

        if (results?.error) {
          throw toVisaSdkError(results.error);
        }

        return results ?? {};
      }),
    logout: () =>
      guard(async () => {
        await sdk.logout();
      }),
    getCorrelationId: () => {
      try {
        return sdk.getCorrelationId();
      } catch {
        return undefined;
      }
    },
  };
};
