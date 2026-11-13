(() => {
  const WALLET_LABELS = { APPLE: 'Apple Wallet', GOOGLE: 'Google Wallet' };

  const byId = (id) => document.getElementById(id);
  const buttons = {
    APPLE: byId('add-to-apple-wallet-button'),
    GOOGLE: byId('add-to-google-wallet-button'),
  };
  const statuses = {
    APPLE: byId('apple-wallet-status'),
    GOOGLE: byId('google-wallet-status'),
  };

  let config;
  let attempt = 0;
  let walletWindowOpen = false;

  const setState = (state, message = '') => {
    document.body.dataset.state = state;
    byId('status').textContent = message;
    byId('result').hidden = state !== 'success' && state !== 'failed';
  };

  const disableButtons = () => {
    Object.values(buttons).forEach((button) => {
      button.disabled = true;
    });
  };

  const showOutcome = ({ state, message, code, correlationId, retryLabel }) => {
    walletWindowOpen = false;
    disableButtons();
    byId('result-message').textContent = message;
    byId('result-code').textContent = code ?? 'n/a';
    byId('result-correlation-id').textContent = correlationId ?? 'n/a';
    byId('retry-button').textContent = retryLabel;
    setState(state);
  };

  const showResult = (result) => {
    const wallet = WALLET_LABELS[result.wallet];

    if (result.success) {
      showOutcome({
        state: 'success',
        message: `Card added to ${wallet}.`,
        code: result.code,
        correlationId: result.correlationId,
        retryLabel: 'Add to another wallet',
      });

      return;
    }

    showOutcome({
      state: 'failed',
      message:
        result.status === 'partial'
          ? `The card was only partly added to ${wallet}.`
          : `The card could not be added to ${wallet}.`,
      code: result.code,
      correlationId: result.correlationId,
      retryLabel: 'Try again',
    });
  };

  const showFailure = (error) => {
    showOutcome({
      state: 'failed',
      message: error.message || 'Something went wrong.',
      code: error.code ?? error.status,
      correlationId: error.correlationId,
      retryLabel: 'Try again',
    });
  };

  const loadConfig = async () => {
    const response = await fetch('/config');
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error);
    }

    return body;
  };

  const createSession = async () => {
    const response = await fetch(`${config.apiBaseUrl}/sessions`, {
      method: 'POST',
      headers: { 'BT-API-KEY': config.publicApiKey },
    });

    if (!response.ok) {
      throw new Error(`Session creation failed with ${response.status}`);
    }

    return response.json();
  };

  const authorizeSession = async (nonce) => {
    const response = await fetch('/authorize-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nonce }),
    });

    if (!response.ok) {
      throw new Error(`Session authorization failed with ${response.status}`);
    }
  };

  const createClient = async (sessionKey) => {
    const client = window.BasisTheoryPushProvisioning(sessionKey, {
      environment: config.environment,
      appId: config.appId,
      apiBaseUrl: config.apiBaseUrl,
    });

    if (config.environment === 'mock') {
      const scenario = new URLSearchParams(window.location.search).get(
        'scenario'
      );

      await client.loadVisaSdk();
      window.WebSDK.mock.configure({
        signatureSecret: config.mockSignatureSecret,
        ...(scenario ? { scenario } : {}),
      });
    }

    return client;
  };

  const start = async () => {
    const current = ++attempt;
    const isCurrent = () => current === attempt;

    disableButtons();
    setState('loading', 'Checking which wallets this card can be added to...');

    try {
      config ??= await loadConfig();

      const session = await createSession();
      await authorizeSession(session.nonce);

      const client = await createClient(session.session_key);
      const { wallets, appleWallet, googleWallet } =
        await client.getSupportedWallets(config.cardTokenId, {
          containerId: 'web_sdk_container_id',
        });

      if (!isCurrent()) {
        return;
      }

      Object.entries(statuses).forEach(([name, element]) => {
        element.textContent =
          wallets.find((wallet) => wallet.name === name)?.status ??
          'NOT_SUPPORTED';
      });

      const handlers = { APPLE: appleWallet, GOOGLE: googleWallet };

      Object.entries(handlers).forEach(([name, handler]) => {
        if (!handler) {
          return;
        }

        handler().then(
          (result) => isCurrent() && showResult(result),
          (error) => isCurrent() && showFailure(error)
        );
        buttons[name].disabled = false;
      });

      setState('ready', 'Choose a wallet.');
    } catch (error) {
      if (isCurrent()) {
        showFailure(error);
      }
    }
  };

  Object.values(buttons).forEach((button) => {
    button.addEventListener('click', () => {
      walletWindowOpen = true;
    });
  });

  // Leaving the page while a wallet window is open loses the result.
  window.addEventListener('beforeunload', (event) => {
    if (walletWindowOpen) {
      event.preventDefault();
    }
  });

  byId('sign-in-button').addEventListener('click', () => {
    byId('sign-in').hidden = true;
    byId('wallets').hidden = false;
    void start();
  });

  byId('retry-button').addEventListener('click', () => {
    void start();
  });
})();
