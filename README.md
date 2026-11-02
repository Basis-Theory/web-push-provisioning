# `web-push-provisioning`

Browser SDK that lets a cardholder add a Basis Theory vaulted card to Apple Pay or Google Wallet from a web page, without the card number ever reaching the page. It wraps the Visa Digital Enablement (VDE) JavaScript SDK and exchanges the Visa session nonce for an encrypted card payload through the Basis Theory API.

> Status: scaffold. The wallet flow (`getSupportedWallets`, wallet buttons, result mapping) lands in follow-up releases.

## Install

```bash
npm install @basis-theory/web-push-provisioning
```

## Usage

```typescript
import { BasisTheoryPushProvisioning } from '@basis-theory/web-push-provisioning';

const bt = BasisTheoryPushProvisioning('<SESSION_OR_PUBLIC_API_KEY>', {
  environment: 'sandbox', // or 'production'
});
```

### Options

| Option             | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `environment`      | `sandbox` (default) or `production`; selects the Visa-hosted script.        |
| `apiBaseUrl`       | Overrides the Basis Theory API host.                                        |
| `region`           | `us` or `eu`; selects a regional API host. `apiBaseUrl` takes precedence.   |
| `visaSdkUrl`       | Overrides the Visa script URL, for example to point at a local mock.        |
| `disableTelemetry` | Disables SDK telemetry.                                                     |

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
