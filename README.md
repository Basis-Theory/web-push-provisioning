# `web-push-provisioning`

Browser SDK that lets a cardholder add a Basis Theory vaulted card to Apple Pay or Google Wallet from a web page, without the card number ever reaching the page. It wraps the Visa Digital Enablement (VDE) JavaScript SDK and exchanges the Visa session nonce for an encrypted card payload through the Basis Theory API.

> Status: scaffold. The wallet flow (`getSupportedWallets`, wallet buttons, result mapping) lands in follow-up releases.

## Install

```bash
npm install @basis-theory/web-push-provisioning
```

## Usage

The page needs a button per wallet in the DOM before provisioning starts: the Visa SDK binds the click itself and opens the wallet's own window. Always show both wallets on web, since the cardholder may be adding the card to a different device.

```html
<button id="add-to-apple-wallet-button">Add to Apple Wallet</button>
<button id="add-to-google-wallet-button">Add to Google Wallet</button>
```

```typescript
import { BasisTheoryPushProvisioning } from '@basis-theory/web-push-provisioning';

const bt = BasisTheoryPushProvisioning('<SESSION_OR_PUBLIC_API_KEY>', {
  environment: 'sandbox', // or 'production'
  appId: '<VISA_APP_ID>',
});

// Loads the Visa script, starts a Visa session, exchanges the nonce for an
// encrypted card payload through the Basis Theory API, and asks Visa which
// wallets the card can be added to.
const { wallets, appleWallet, googleWallet } =
  await bt.getSupportedWallets('<CARD_TOKEN_ID>');

// wallets -> [{ name: 'APPLE', logoUrl, status: 'ELIGIBLE' }, { name: 'GOOGLE', ... }]

// Each handler binds its button and resolves once the wallet reports back.
appleWallet?.().then(showResult);
googleWallet?.({ provisionDeviceToken: false }).then(showResult);

function showResult(result) {
  if (result.success) {
    // Card added. Call getSupportedWallets again to refresh the status.
  } else {
    // result.status is 'partial' or 'error'; log result.correlationId for Visa support.
  }
}
```

The API key must be a Basis Theory session key or public key. Private keys must never be used in the browser.

### Options

| Option             | Description                                                                      |
| ------------------ | -------------------------------------------------------------------------------- |
| `environment`      | `sandbox` (default), `production`, or `mock`; selects the Visa script.           |
| `appId`            | Visa AppID issued for the tenant. Required for `sandbox` and `production`.       |
| `apiBaseUrl`       | Overrides the Basis Theory API host.                                             |
| `region`           | `us` or `eu`; selects a regional API host. `apiBaseUrl` takes precedence.        |
| `visaSdkUrl`       | Overrides the Visa script URL, for example to point at a local copy of the mock. |
| `disableTelemetry` | Disables SDK telemetry.                                                          |

### `getSupportedWallets(cardTokenId, options?)`

| Option          | Description                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `containerId`   | Element the Visa SDK renders into. When omitted a `web_sdk_container_id` div is appended to the body. |
| `correlationId` | Sent to the Basis Theory API as `BT-TRACE-ID`.                                                        |

Returns `{ wallets, appleWallet, googleWallet }`. A handler is present only when Visa returned that wallet for the card. Visa errors (for example `VDC_ERROR_409` lockout or `VPPW_ERROR_004` no wallets) reject with a `VisaSdkError` carrying `code` and `correlationId`; Basis Theory API errors reject with a `BasisTheoryPushProvisioningError`.

### Wallet handlers

Call a handler before the cardholder clicks, not from the click: it binds the button through the Visa SDK and resolves with a `ProvisioningResult` when the wallet flow completes.

| Option                         | Wallet | Description                                                                 |
| ------------------------------ | ------ | --------------------------------------------------------------------------- |
| `buttonId`                     | both   | Defaults to `add-to-apple-wallet-button` and `add-to-google-wallet-button`. |
| `provisionCardToGoogleAccount` | Google | Add the card to the Google account. Defaults to `true`.                     |
| `provisionDeviceToken`         | Google | Add the card to the cardholder's Android devices. Defaults to `true`.       |

At least one of the two Google options must stay `true`. A handler rejects with a `VisaSdkError` when setup fails before the wallet flow starts (for example `VPPW_ERROR_002` when the button is not in the DOM).

`ProvisioningResult`:

| Field           | Description                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| `success`       | `true` only when Visa reported the card as added (`VPPW_1200`, `VPPW_1206`, `VPPW_2002`, `VPPW_2003`, `VPPW_2004`). |
| `status`        | `success`, `partial` (`VPPW_2005`, `VPPW_2006`) or `error`.                                                         |
| `code`          | Visa result or error code.                                                                                          |
| `message`       | Visa message.                                                                                                       |
| `correlationId` | Visa correlation id; Visa support needs it.                                                                         |
| `wallet`        | `APPLE` or `GOOGLE`.                                                                                                |

Once any wallet reports a result the Visa session ends (`logout()`), so the other wallet's handler stays pending and the page should call `getSupportedWallets` again. The session also ends when the page is hidden or unloaded, and on an explicit `bt.logout()`.

### Mock Visa SDK for dev and UAT

Until Visa provisions an AppID, the dev CDN serves a mock of the Visa script that issues real HS256 nonces signed with the tenant's test Signature Secret. Dev and UAT integrations both load it from there with `environment: 'mock'`; no `appId` is needed. Configure the secret before the first `getSupportedWallets` call, either by defining `window.WebSDKMockConfig` before the script loads or by preloading the script:

```typescript
const bt = BasisTheoryPushProvisioning('<PUBLIC_API_KEY>', {
  environment: 'mock',
});
await bt.loadVisaSdk();
window.WebSDK.mock.configure({
  signatureSecret: '<tenant test signature secret>',
});
```

See [`examples/mock/README.md`](examples/mock/README.md) for the scenarios and options.

## Prerequisites

- A Basis Theory tenant enabled for push provisioning under the Basis Theory Visa program.
- Card tokens that carry the cardholder name and billing address required by the wallets.
- Wallet onboarding (Apple and Google) owned by the card program.

## Development

```bash
yarn install
yarn build
yarn test
yarn lint
```

See [`examples/`](examples/README.md) for integration samples.

## License

Apache-2.0
