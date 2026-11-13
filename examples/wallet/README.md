# Wallet page example

A runnable page that adds a card to Apple Wallet or Google Wallet with `@basis-theory/web-push-provisioning`, plus the one backend call the flow needs. It runs against the [mock Visa SDK](../mock/README.md) by default, so it works before Visa issues an AppID.

| File         | Role                                                                                |
| ------------ | ----------------------------------------------------------------------------------- |
| `index.html` | The wallet screen: sign-in gate, Visa container, both wallet buttons, result panel. |
| `wallet.js`  | Browser flow: session, `getSupportedWallets`, wallet handlers, confirmation, retry. |
| `server.mjs` | Stand-in for your backend: serves the page and authorizes the session for one card. |

## Run it

You need a TEST tenant enabled for push provisioning, with `web` credentials configured for the sandbox environment, and two applications:

- a public application, used by the page to create a session;
- a private application with `token:create` and `token:use`, used by the server to create a sample card token and authorize the session.

```bash
yarn install
yarn build

BT_PUBLIC_API_KEY=<public key> \
BT_PRIVATE_API_KEY=<private key> \
PUSH_PROVISIONING_SIGNATURE_SECRET=<tenant test signature secret> \
yarn example
```

Open <http://localhost:4173>.

| Variable                             | Default                            | Purpose                                                                           |
| ------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------- |
| `BT_PUBLIC_API_KEY`                  | required                           | Public application key. Sent to the browser.                                      |
| `BT_PRIVATE_API_KEY`                 | required                           | Private application key. Stays on the server.                                     |
| `BT_API_URL`                         | `https://api.test.basistheory.com` | Basis Theory API host.                                                            |
| `PUSH_PROVISIONING_ENVIRONMENT`      | `mock`                             | `mock`, `sandbox` or `production`.                                                |
| `PUSH_PROVISIONING_SIGNATURE_SECRET` | required for `mock`                | The tenant's active `web` Signature Secret. The mock signs its nonce with it.     |
| `VISA_APP_ID`                        | required for the Visa environments | Visa AppID issued for the tenant.                                                 |
| `CARD_TOKEN_ID`                      | a sample card created on startup   | Card token to provision. It needs `cardholder_name` and a full `billing_address`. |
| `PORT`                               | `4173`                             | Port the example listens on.                                                      |

With the mock, the Signature Secret is sent to the browser. Use a dedicated test secret on a TEST tenant only. Append `?scenario=<name>` to the URL to try the mock's [failure scenarios](../mock/README.md#scenarios), for example `?scenario=no-wallets`.

## What the page shows

1. **Strong authentication comes first.** The Sign in button stands in for your portal's login. Start provisioning only for an authenticated member.
2. **Session.** The page creates a Basis Theory session with the public key and sends its `nonce` to the backend. The backend authorizes the session with a `token:use` rule scoped to the one card token, so the session key cannot generate a payload for any other card.
3. **Wallets.** `getSupportedWallets` loads the Visa script into the `web_sdk_container_id` element, exchanges Visa's nonce for an encrypted card payload and returns the wallets the card can be added to.
4. **Buttons.** `add-to-apple-wallet-button` and `add-to-google-wallet-button` are always in the DOM with those ids, and both wallets are always shown: the member may be adding the card to a different device. The Visa SDK binds the click, so the page calls each wallet handler before the click and only enables the button afterwards.
5. **Result.** Each handler resolves with a `ProvisioningResult`. On success the page shows a confirmation; on a partial or failed result it shows the code, the correlation id and a retry. Either way the Visa session has ended, so the next attempt starts again from a new session.

## Rules to carry into your page

- **Do not close or navigate away from the page while a wallet window is open.** Apple and Google open their own windows, and provisioning can still succeed after the member dismisses them. Leaving the page ends the Visa session and loses the result. The example warns through `beforeunload` from the wallet button click until the result arrives; keep single-page-app route changes out of that window too.
- **Google's button is a Google-hosted image.** Load it from `https://pay.google.com/gp/v/a/pushprovisioning/saveButtonImage?hl=en-US` and reserve 100 to 300 px of width for it.
- **Apple's button here is a placeholder.** The real asset comes from Apple Business Register during the implementation project. Swap it in and follow Apple's brand guidelines.
- **Log `correlationId`.** Visa support needs it to trace an attempt.

## End-to-end test

`e2e/wallet.spec.ts` drives this example with Playwright against the mock and a real Basis Theory environment. It checks that a session is created, a payload is generated, both wallets are returned, and that success and failure results render.

```bash
yarn build
npx playwright install chromium
BT_API_URL=<api host> BT_PUBLIC_API_KEY=... BT_PRIVATE_API_KEY=... PUSH_PROVISIONING_SIGNATURE_SECRET=... yarn test:e2e
```

CI runs it on every pull request against dev (`https://api.flock-dev.com`), reading `E2E_BT_PUBLIC_API_KEY`, `E2E_BT_PRIVATE_API_KEY` and `E2E_PUSH_PROVISIONING_SIGNATURE_SECRET` from the `PR` environment secrets.
