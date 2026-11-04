import {
  DEFAULT_BUTTON_IDS,
  VISA_SDK_CONTAINER_ID,
  WALLETS,
  Wallet,
} from '~src/constants';
import {
  ProvisioningResult,
  mapProvisioningResult,
} from '~src/handlers/results';
import {
  VisaSdkAdapter,
  VisaSupportedWallet,
  VisaWalletSetup,
  VisaWalletSetupOptions,
} from '~src/handlers/visaSdk';
import type { EncryptedCardPayloadRequest } from '~src/session';
import type { Logger } from '~src/utils/logging';

export type WalletStatus = 'ELIGIBLE' | 'ALREADY_PROVISIONED' | (string & {});

export type SupportedWallet = {
  name: Wallet;
  logoUrl?: string;
  status?: WalletStatus;
};

export type WalletHandlerOptions = {
  /**
   * Id of the button that starts provisioning. The Visa SDK binds the click
   * itself, so the element must already be in the DOM. Defaults to
   * `add-to-apple-wallet-button` and `add-to-google-wallet-button`.
   */
  buttonId?: string;
};

export type GoogleWalletHandlerOptions = WalletHandlerOptions & {
  /**
   * Add the card to the cardholder's Google account. Defaults to `true`.
   */
  provisionCardToGoogleAccount?: boolean;
  /**
   * Add the card to the cardholder's Android devices. Defaults to `true`.
   */
  provisionDeviceToken?: boolean;
};

export type AppleWalletHandler = (
  options?: WalletHandlerOptions
) => Promise<ProvisioningResult>;

export type GoogleWalletHandler = (
  options?: GoogleWalletHandlerOptions
) => Promise<ProvisioningResult>;

export type SupportedWalletsOptions = {
  /**
   * Id of the element the Visa SDK renders into. When omitted a hidden
   * `web_sdk_container_id` div is appended to the body.
   */
  containerId?: string;
  correlationId?: string;
};

export type SupportedWalletsResponse = {
  wallets: SupportedWallet[];
  /**
   * Present when Apple Wallet was returned for the card.
   */
  appleWallet?: AppleWalletHandler;
  /**
   * Present when Google Wallet was returned for the card.
   */
  googleWallet?: GoogleWalletHandler;
};

export type WalletFlow = {
  getSupportedWallets: (
    cardTokenId: string,
    options?: SupportedWalletsOptions
  ) => Promise<SupportedWalletsResponse>;
  logout: () => Promise<void>;
};

type Session = {
  encryptedCardPayload: string;
  setups: Map<Wallet, VisaWalletSetup>;
};

type WalletFlowDependencies = {
  getAdapter: () => Promise<VisaSdkAdapter>;
  requestEncryptedCardPayload: (
    request: EncryptedCardPayloadRequest
  ) => Promise<{ encryptedCardPayload: string }>;
  logger: Logger;
};

const isWallet = (name: string): name is Wallet =>
  Object.values(WALLETS).includes(name as Wallet);

const resolveContainerId = (containerId?: string): string => {
  if (containerId) {
    if (!document.getElementById(containerId)) {
      throw new Error(`Container element "${containerId}" was not found`);
    }

    return containerId;
  }

  if (!document.getElementById(VISA_SDK_CONTAINER_ID)) {
    const container = document.createElement('div');
    container.id = VISA_SDK_CONTAINER_ID;
    document.body.appendChild(container);
  }

  return VISA_SDK_CONTAINER_ID;
};

const googleSetupOptions = (
  options: GoogleWalletHandlerOptions
): Pick<
  VisaWalletSetupOptions,
  'provisionCardToGoogleAccount' | 'provisionDeviceToken'
> => {
  const provisionCardToGoogleAccount =
    options.provisionCardToGoogleAccount ?? true;
  const provisionDeviceToken = options.provisionDeviceToken ?? true;

  if (!provisionCardToGoogleAccount && !provisionDeviceToken) {
    throw new Error(
      'At least one of provisionCardToGoogleAccount or provisionDeviceToken must be true'
    );
  }

  return { provisionCardToGoogleAccount, provisionDeviceToken };
};

export const createWalletFlow = ({
  getAdapter,
  requestEncryptedCardPayload,
  logger,
}: WalletFlowDependencies): WalletFlow => {
  let adapter: VisaSdkAdapter | undefined;
  let renderedContainerId: string | undefined;
  let session: Session | undefined;
  let initialized = false;
  let generation = 0;
  let unloadListenerAttached = false;

  const logoutVisa = async () => {
    try {
      await adapter?.logout();
    } catch (error) {
      void logger.log.warn(
        `Visa web SDK logout failed: ${(error as Error).message}`
      );
    }
  };

  const logout = async (): Promise<void> => {
    session = undefined;

    if (!initialized) {
      return;
    }

    initialized = false;
    await logoutVisa();
  };

  const attachUnloadListener = () => {
    if (unloadListenerAttached) {
      return;
    }

    unloadListenerAttached = true;
    window.addEventListener('pagehide', () => {
      void logout();
    });
  };

  const ensureRendered = async (containerId?: string) => {
    adapter ??= await getAdapter();
    const target = resolveContainerId(containerId);

    if (renderedContainerId !== target) {
      await adapter.render(target);
      renderedContainerId = target;
    }

    return adapter;
  };

  const createHandler =
    (wallet: Wallet, current: Session) =>
    async (
      options: GoogleWalletHandlerOptions = {}
    ): Promise<ProvisioningResult> => {
      const walletOptions =
        wallet === WALLETS.GOOGLE ? googleSetupOptions(options) : {};

      if (session !== current || !adapter) {
        throw new Error(
          'The push provisioning session has ended; call getSupportedWallets again'
        );
      }

      const sdk = adapter;

      return new Promise<ProvisioningResult>((resolve, reject) => {
        let settled = false;

        current.setups.set(wallet, {
          wallet,
          options: {
            ...walletOptions,
            buttonId: options.buttonId ?? DEFAULT_BUTTON_IDS[wallet],
            provisioningResultCallback: (raw) => {
              if (settled) {
                return;
              }

              settled = true;
              const result = mapProvisioningResult(
                wallet,
                raw,
                sdk.getCorrelationId()
              );

              void logger.log.info('push-provisioning-result', {
                wallet,
                status: result.status,
                code: result.code ?? '',
                correlationId: result.correlationId ?? '',
              });

              void logout().then(() => resolve(result));
            },
          },
        });

        sdk
          .setupPushProvisioning(
            current.encryptedCardPayload,
            Array.from(current.setups.values())
          )
          .catch((error: Error) => {
            current.setups.delete(wallet);
            settled = true;
            reject(error);
          });
      });
    };

  const getSupportedWallets = async (
    cardTokenId: string,
    options: SupportedWalletsOptions = {}
  ): Promise<SupportedWalletsResponse> => {
    if (!cardTokenId) {
      throw new Error('cardTokenId is required');
    }

    // Guards against overlapping calls: only the newest invocation may own
    // the Visa session or tear it down.
    const mine = ++generation;
    const superseded = () =>
      new Error(
        'getSupportedWallets was called again before this call completed'
      );

    await logout();
    const sdk = await ensureRendered(options.containerId);
    attachUnloadListener();

    const nonce = await sdk.initialize();

    if (generation !== mine) {
      // A newer call that already initialized owns the session; otherwise
      // this initialize left Visa with a session nobody tracks.
      if (!initialized) {
        await logoutVisa();
      }
      throw superseded();
    }

    initialized = true;

    let encryptedCardPayload: string;
    let supported: VisaSupportedWallet[];

    try {
      ({ encryptedCardPayload } = await requestEncryptedCardPayload({
        nonce,
        tokenId: cardTokenId,
        correlationId: options.correlationId,
      }));
      supported = await sdk.getSupportedWallets(encryptedCardPayload);
    } catch (error) {
      if (generation === mine) {
        await logout();
      }
      throw error;
    }

    if (generation !== mine) {
      throw superseded();
    }

    const current: Session = { encryptedCardPayload, setups: new Map() };
    session = current;

    const wallets: SupportedWallet[] = supported
      .filter((wallet) => isWallet(wallet.walletName))
      .map((wallet) => ({
        name: wallet.walletName as Wallet,
        logoUrl: wallet.walletLogo || undefined,
        status: wallet.walletStatus,
      }));

    const names = new Set(wallets.map((wallet) => wallet.name));

    return {
      wallets,
      appleWallet: names.has(WALLETS.APPLE)
        ? createHandler(WALLETS.APPLE, current)
        : undefined,
      googleWallet: names.has(WALLETS.GOOGLE)
        ? createHandler(WALLETS.GOOGLE, current)
        : undefined,
    };
  };

  return { getSupportedWallets, logout };
};
