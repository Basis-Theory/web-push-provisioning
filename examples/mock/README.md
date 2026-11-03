# Mock Visa web SDK

`web_sdk.js` stands in for Visa's hosted web SDK until Visa provisions a real AppID. It exposes the same `WebSDK` global and method inventory as the live bundle, and its `initialize()` returns a real HS256 nonce signed with the test Signature Secret you configure, so `POST /push-provisioning` verifies it unchanged.

## Where it is served

| Environment | URL                                                                        |
| ----------- | -------------------------------------------------------------------------- |
| dev         | `https://cdn.flock-dev.com/javascript/push-provisioning/mock/web_sdk.js`   |
| uat         | `https://cdn.basistheory.com/javascript/push-provisioning/mock/web_sdk.js` |

Both URLs are exported from the package as `VISA_SDK_MOCK_URLS`. Pass one as `visaSdkUrl` to make the wrapper load the mock instead of Visa's script. The deployed copy lives in the `cdn.basistheory.com` repository under `javascript/push-provisioning/mock/`; update it alongside this file.

## Configuration

The mock never ships a secret. Set the tenant's test Signature Secret from the page, before `initialize()`:

```html
<script src="https://cdn.flock-dev.com/javascript/push-provisioning/mock/web_sdk.js?appId=mock"></script>
<script>
  WebSDK.mock.configure({ signatureSecret: '<tenant test signature secret>' });
</script>
```

`WebSDKMockConfig`, when defined before the script loads, is read as the initial configuration. `WebSDK.mock.reset()` restores the defaults.

| Option            | Default                                   | Purpose                                                                                                     |
| ----------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `signatureSecret` | none, required                            | HMAC key for the nonce. Must match the tenant's active `web` secret.                                        |
| `scenario`        | `success`                                 | See below.                                                                                                  |
| `nonceTtlMs`      | `300000`                                  | Lifetime written into the nonce `iat` and `exp` headers.                                                    |
| `resultDelayMs`   | `0`                                       | Delay before a wallet button click reports its result.                                                      |
| `wallets`         | Apple and Google, `ELIGIBLE`              | What `getSupportedWallets` returns.                                                                         |
| `results`         | `VPPW_1200` for Apple, `VPPW_2002` Google | Per-wallet result passed to `provisioningResultCallback`. Use `{ error: { code, message } }` for a failure. |

## Scenarios

| Scenario         | Behaviour                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `success`        | Documented happy path.                                                                                                     |
| `expired-nonce`  | `initialize()` issues an already-expired nonce, so the payload API rejects it, and wallet calls fail with `VDC_ERROR_403`. |
| `lockout`        | `initialize()` rejects with `VDC_ERROR_409`.                                                                               |
| `no-wallets`     | `getSupportedWallets` rejects with `VPPW_ERROR_004`.                                                                       |
| `missing-button` | `setupPushProvisionSDK` rejects with `VPPW_ERROR_002`. This also happens whenever a `buttonId` is not in the DOM.          |

Wallet calls made before `initialize()` or after `logout()` reject with `VW_ERROR_427`, as observed on the live bundle. Every error carries `code` and `correlationId`; `getPushProvisioningUX()` returns a placeholder shape until the real response is observed.
