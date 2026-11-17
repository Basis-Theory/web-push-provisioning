# `web-push-provisioning`

Browser SDK that lets a cardholder add a Basis Theory vaulted card to Apple Pay or Google Wallet from a web page, without the card number ever reaching the page. It wraps the Visa Digital Enablement (VDE) JavaScript SDK and exchanges the Visa session nonce for an encrypted card payload through the Basis Theory API.

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
// status is 'ELIGIBLE', 'PROVISIONED' or 'UNSUPPORTED'

// Each handler binds its button and resolves once the wallet reports back.
appleWallet?.().then(showResult);
googleWallet?.().then(showResult);

function showResult(result) {
  if (result.success) {
    // Card added. Call getSupportedWallets again to refresh the status.
  } else if (result.status === 'unknown') {
    // Visa could not confirm the outcome: the card may still be added.
    // Ask the cardholder to check their device before retrying.
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
| `locale`           | Language for Google Wallet's window, for example `en-US`.                        |
| `visaSdkUrl`       | Overrides the Visa script URL, for example to point at a local copy of the mock. |
| `disableTelemetry` | Disables SDK telemetry.                                                          |

### `getSupportedWallets(cardTokenId, options?)`

| Option          | Description                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `containerId`   | Element the Visa SDK renders into. When omitted a `web_sdk_container_id` div is appended to the body. |
| `correlationId` | Sent to the Basis Theory API as `BT-TRACE-ID`.                                                        |

Returns `{ wallets, appleWallet, googleWallet }`. A handler is present only when Visa returned that wallet for the card. Visa errors (for example `VDC_ERROR_409` lockout or `VPPW_ERROR_004` no wallets) reject with a `VisaSdkError` carrying `code` and `correlationId`; Basis Theory API errors reject with a `BasisTheoryPushProvisioningError`.

### Wallet handlers

Call a handler before the cardholder clicks, not from the click: it binds the button through the Visa SDK and resolves with a `ProvisioningResult` when the wallet flow completes. Call both handlers together, as in the example above: handlers called in the same tick are set up with a single Visa call.

| Option                         | Wallet | Description                                                                 |
| ------------------------------ | ------ | --------------------------------------------------------------------------- |
| `buttonId`                     | both   | Defaults to `add-to-apple-wallet-button` and `add-to-google-wallet-button`. |
| `provisionCardToGoogleAccount` | Google | Also save the card to the Google account. Defaults to `false`.              |
| `provisionDeviceToken`         | Google | Add the card to the cardholder's Android devices. Defaults to `true`.       |

At least one of the two Google options must stay `true`. `provisionCardToGoogleAccount` shares the card number with Google: enable it only when Visa has configured it for your program and your page carries the cardholder disclosures and consent it requires. A handler rejects with a `VisaSdkError` when Visa fails to set its wallet up (for example `VPPW_ERROR_002` when the button is not in the DOM); the other wallet's handler is not affected.

`ProvisioningResult`:

| Field            | Description                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `success`        | `true` only when Visa reported the card as added (`VPPW_1200`, `VPPW_1206`, `VPPW_2002`, `VPPW_2003`, `VPPW_2004`). |
| `status`         | `success`, `partial` (`VPPW_2005`, `VPPW_2006`), `unknown` (`VPPW_1201`, `VPPW_110001`, `VPPW_110002`) or `error`.  |
| `code`           | First Visa result or error code.                                                                                    |
| `message`        | Visa message for `code`.                                                                                            |
| `codes`          | Every code Visa reported. Google Wallet can report more than one.                                                   |
| `nonFatalErrors` | Problems Google Wallet reported alongside a result that still went through.                                         |
| `correlationId`  | Visa correlation id; Visa support needs it.                                                                         |
| `wallet`         | `APPLE` or `GOOGLE`.                                                                                                |

`unknown` means Visa could not confirm the outcome and the card may still reach the device, so do not present it as a failure. `VPPW_1206` means the card was added to some of the Apple devices the cardholder selected.

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

- A Basis Theory tenant enabled for push provisioning under the Basis Theory Visa program. Basis Theory enables the feature, sets the tenant's Visa source and credentials, and turns on BIN details enrichment, which the payload needs to report the card's funding type.
- Card tokens that carry `cardholder_name` and a `billing_address` with `line1`, `city`, `state_code`, `postal_code`, `country_code` and `phone_number`.
- A tenant dedicated to mock testing, separate from the one that holds Visa-issued sandbox credentials.
- Wallet onboarding (Apple and Google) owned by the card program.

## Development

```bash
yarn install
yarn build
yarn test
yarn lint
```

See [`examples/`](examples/README.md) for integration samples, including a [runnable wallet page](examples/wallet/README.md) that the Playwright end-to-end test (`yarn test:e2e`) drives against the mock.

## License

Apache-2.0
