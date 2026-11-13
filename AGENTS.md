# Web Push Provisioning

TypeScript browser SDK that wraps the Visa Digital Enablement (VDE) JavaScript SDK and exchanges its session nonce for an encrypted card payload through the Basis Theory API.

## Build & Test

```bash
yarn install
yarn build                              # prepare.js + generateTypes + parcel build
yarn test                               # Jest unit tests (jsdom)
yarn lint                               # ESLint
npx jest --testPathPattern="<pattern>"  # Targeted test
yarn test:coverage                      # Tests with coverage
yarn test:e2e                           # Playwright against the wallet example (needs a build and tenant env vars)
```

Always verify fixes with targeted tests before considering done.

## Project Structure

- `src/index.ts` — Public factory `BasisTheoryPushProvisioning(apiKey, options)`
- `src/wallets.ts` — `getSupportedWallets` session flow, per-wallet handlers, logout
- `src/session.ts` — Nonce and payload exchange with `POST /push-provisioning`
- `src/handlers/visaSdk.ts` — Adapter seam over the Visa `WebSDK` global (mock or live); the only place that knows where Visa's methods live
- `src/handlers/results.ts` — Visa result code to `ProvisioningResult` mapping
- `src/handlers/loadScript.ts` — Script injection that waits for the global
- `src/constants.ts` — API hosts, Visa script URLs, header names
- `src/utils/` — HTTP client, logging, error mapping
- `test/` — Unit tests (Jest + jsdom)
- `examples/` — Integration samples
- `examples/wallet/` — Runnable wallet page and its stand-in backend (`yarn example`)
- `e2e/` — Playwright test that runs the wallet example against dev with the mock; CI job `E2E` reads the test tenant from the `PR` environment secrets
- `examples/mock/web_sdk.js` — Mock Visa web SDK served from the dev CDN for dev and UAT (deployed copy lives in `cdn.basistheory.com` under `dev/javascript/push-provisioning/mock/`)
- `scripts/prepare.js` — Creates dist/package.json before the Parcel build

## Gotchas

- **Parcel bundler**: targets configured in `package.json` `"targets"`. Outputs: `dist/main/` (CJS), `dist/module/` (ESM), `dist/types/` (declarations), `dist/bundle/` (browser global).
- **The Visa script is Visa-hosted**: it is loaded by URL with the tenant's AppID and sets the `WebSDK` global synchronously; wait for the global, not the script `load` event.
- **Visa binds the buttons**: `setupPushProvisionSDK` attaches click listeners itself and replaces earlier bindings on every call, so the wallet flow re-sends every wallet set up in the session on each handler call. Handlers must be called before the click, not from it.
- **Mock in jsdom**: the mock needs `crypto.subtle` and `TextEncoder` from Node, and jsdom never executes injected scripts, so tests `require` the mock and add a `<script src>` tag matching the configured URL for `loadScript` to find it.
- **Wire format**: the Basis Theory API uses snake_case (`token_id`, `encrypted_card_payload`); the SDK exposes camelCase.
- **Size limits**: `size-limit` in `package.json` caps the main and module targets.
- **Husky git hooks**: `husky install` runs on `prepare`. CI disables with `HUSKY=0`.
- **`yarn` not `npm`**: yarn classic with `yarn.lock`.
- **Version in package.json**: CI pins it from the release tag via `make update-version` before publish.

## Release

`deploy-dev.yml` runs on every push to master: build, then a `v*` tag and GitHub pre-release. Promoting the pre-release to a release triggers `release.yml`: verify the tag, build, `npm publish` with trusted publishing (OIDC, `PROD` environment), and commit the version back to master. Published as `@basis-theory/web-push-provisioning`.
