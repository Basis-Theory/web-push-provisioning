// Method inventory from the 2026-09-16 live bundle probe; shapes from the Oct 2024 draft guide.
(function (global) {
  'use strict';

  const SUPPORTED_WALLETS = Object.freeze({ APPLE: 'APPLE', GOOGLE: 'GOOGLE' });
  const SCENARIOS = Object.freeze([
    'success',
    'expired-nonce',
    'lockout',
    'no-wallets',
    'missing-button',
  ]);
  const GOOGLE_BUTTON_IMAGE =
    'https://pay.google.com/gp/v/a/pushprovisioning/saveButtonImage?hl=en-US';

  const defaultConfig = () => ({
    signatureSecret: '',
    scenario: 'success',
    nonceTtlMs: 5 * 60 * 1000,
    resultDelayMs: 0,
    wallets: [
      { walletName: 'APPLE', walletLogo: '', walletStatus: 'ELIGIBLE' },
      {
        walletName: 'GOOGLE',
        walletLogo: GOOGLE_BUTTON_IMAGE,
        walletStatus: 'ELIGIBLE',
      },
    ],
    results: {
      APPLE: { code: 'VPPW_1200', message: 'Card added to Apple Wallet' },
      GOOGLE: { code: 'VPPW_2002', message: 'Card added to Google Wallet' },
    },
  });

  const merge = (base, overrides) => {
    if (!overrides) {
      return base;
    }
    if (overrides.scenario && SCENARIOS.indexOf(overrides.scenario) === -1) {
      throw new Error(`WebSDK mock: unknown scenario ${overrides.scenario}`);
    }
    return Object.assign({}, base, overrides, {
      results: Object.assign({}, base.results, overrides.results),
    });
  };

  let config = merge(defaultConfig(), global.WebSDKMockConfig);

  const utf8 = (text) => new TextEncoder().encode(text);

  const base64Url = (bytes) => {
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return global
      .btoa(binary)
      .replace(/=+$/u, '')
      .replace(/\+/gu, '-')
      .replace(/\//gu, '_');
  };

  const randomHex = (byteLength) => {
    const bytes = new Uint8Array(byteLength);
    global.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    );
  };

  const newCorrelationId = () => `${randomHex(4)}_VMCP`;

  const hmacSha256 = async (secret, data) => {
    const key = await global.crypto.subtle.importKey(
      'raw',
      utf8(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return new Uint8Array(
      await global.crypto.subtle.sign('HMAC', key, utf8(data))
    );
  };

  const signNonce = async (secret, expired) => {
    const now = Date.now();
    const iat = expired ? now - config.nonceTtlMs - 1000 : now;
    const exp = iat + config.nonceTtlMs;
    const header = base64Url(
      utf8(JSON.stringify({ alg: 'HS256', typ: 'JWT', iat, exp }))
    );
    const payload = base64Url(utf8(randomHex(16)));
    const signature = base64Url(
      await hmacSha256(secret, `${header}.${payload}`)
    );
    return { encNonce: `${header}.${payload}.${signature}`, exp };
  };

  const sdkError = (code, message, correlationId) => {
    const error = new Error(message);
    if (code) {
      error.code = code;
    }
    error.correlationId = correlationId;
    return error;
  };

  function WebSDK(options) {
    const onError = options && options.onError;
    const state = {
      rendered: false,
      initialized: false,
      nonceExp: 0,
      locale: 'en-US',
      correlationId: newCorrelationId(),
      bindings: [],
    };

    const fail = (code, message) => {
      const error = sdkError(code, message, state.correlationId);
      if (typeof onError === 'function') {
        onError(error);
      }
      return Promise.reject(error);
    };

    const unbind = () => {
      state.bindings.forEach(({ element, handler }) =>
        element.removeEventListener('click', handler)
      );
      state.bindings = [];
    };

    const guardSession = (encryptedCardPayload) => {
      if (!state.initialized) {
        return fail('VW_ERROR_427', 'IframePromiseHandlerError');
      }
      if (typeof encryptedCardPayload !== 'string' || !encryptedCardPayload) {
        return fail('VDC_ERROR_403', 'Invalid encrypted card payload');
      }
      if (config.scenario === 'expired-nonce' || Date.now() >= state.nonceExp) {
        return fail('VDC_ERROR_403', 'Nonce expired');
      }
      return null;
    };

    const deliver = (wallet, callback) => {
      if (typeof callback !== 'function') {
        return;
      }
      const result = config.results[wallet] || {};
      const correlationId = state.correlationId;
      callback(
        result.error
          ? { wallet, error: Object.assign({ correlationId }, result.error) }
          : Object.assign({ wallet, correlationId }, result)
      );
    };

    const pushProvisioningSdk = {
      SUPPORTED_WALLETS,

      getSupportedWallets(encryptedCardPayload) {
        const rejected = guardSession(encryptedCardPayload);
        if (rejected) {
          return rejected;
        }
        if (config.scenario === 'no-wallets') {
          return fail('VPPW_ERROR_004', 'No supported wallets');
        }
        return Promise.resolve(
          config.wallets.map((wallet) => Object.assign({}, wallet))
        );
      },

      setupPushProvisionSDK(encryptedCardPayload, wallets) {
        const rejected = guardSession(encryptedCardPayload);
        if (rejected) {
          return rejected;
        }
        if (!Array.isArray(wallets) || wallets.length === 0) {
          return fail(
            undefined,
            'WebSDK mock: setupPushProvisionSDK needs at least one wallet'
          );
        }
        unbind();
        for (const entry of wallets) {
          const wallet = entry && entry.wallet;
          const walletOptions = (entry && entry.options) || {};
          if (!SUPPORTED_WALLETS[wallet]) {
            unbind();
            return fail(
              undefined,
              `WebSDK mock: unsupported wallet ${String(wallet)}`
            );
          }
          const element = walletOptions.buttonId
            ? global.document.getElementById(walletOptions.buttonId)
            : null;
          if (!element || config.scenario === 'missing-button') {
            unbind();
            return fail(
              'VPPW_ERROR_002',
              `Button not found: ${String(walletOptions.buttonId)}`
            );
          }
          const handler = () => {
            global.setTimeout(
              () => deliver(wallet, walletOptions.provisioningResultCallback),
              config.resultDelayMs
            );
          };
          element.addEventListener('click', handler);
          state.bindings.push({ element, handler });
        }
        return Promise.resolve({
          code: 'VPPW_1001',
          correlationId: state.correlationId,
        });
      },

      getPushProvisioningUX() {
        return Promise.resolve({
          wallets: config.wallets.map(({ walletName, walletLogo }) => ({
            walletName,
            walletLogo,
          })),
        });
      },
    };

    return {
      render(container) {
        const containerId =
          typeof container === 'string'
            ? container
            : container && container.containerId;
        const element = containerId
          ? global.document.getElementById(containerId)
          : null;
        if (!element) {
          return fail(
            undefined,
            `WebSDK mock: container not found: ${String(containerId)}`
          );
        }
        if (!element.querySelector('data-provider')) {
          const provider = global.document.createElement('data-provider');
          provider.setAttribute('src', 'mock://web-sdk/iframe.html');
          element.appendChild(provider);
        }
        state.rendered = true;
        return Promise.resolve({ coreWebSDKLoaded: true });
      },

      setLocale(locale) {
        state.locale = locale;
      },

      async initialize() {
        if (!state.rendered) {
          return fail(
            undefined,
            'WebSDK mock: call render() before initialize()'
          );
        }
        if (config.scenario === 'lockout') {
          return fail('VDC_ERROR_409', 'SDK locked out');
        }
        if (!config.signatureSecret) {
          return fail(
            undefined,
            'WebSDK mock: set WebSDK.mock.configure({ signatureSecret }) before initialize()'
          );
        }
        const { encNonce, exp } = await signNonce(
          config.signatureSecret,
          config.scenario === 'expired-nonce'
        );
        state.initialized = true;
        state.nonceExp = exp;
        return { encNonce };
      },

      logout() {
        unbind();
        state.initialized = false;
        state.nonceExp = 0;
        return Promise.resolve();
      },

      setCorrelationId(correlationId) {
        state.correlationId = String(correlationId);
      },

      getCorrelationId() {
        return state.correlationId;
      },

      pushProvisioningSdk,
    };
  }

  WebSDK.mock = {
    SCENARIOS,
    configure(overrides) {
      config = merge(config, overrides);
      return config;
    },
    reset() {
      config = defaultConfig();
      return config;
    },
    get config() {
      const { signatureSecret, ...visible } = config;
      return visible;
    },
  };

  global.WebSDK = WebSDK;
})(typeof window !== 'undefined' ? window : globalThis);
