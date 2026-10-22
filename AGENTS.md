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
```

Always verify fixes with targeted tests before considering done.

## Project Structure

- `src/index.ts` — Public factory `BasisTheoryPushProvisioning(apiKey, options)`
- `src/session.ts` — Nonce and payload exchange with `POST /push-provisioning`
- `src/handlers/` — Visa script loading and SDK call handlers
- `src/constants.ts` — API hosts, Visa script URLs, header names
- `src/utils/` — HTTP client, logging, error mapping
- `test/` — Unit tests (Jest + jsdom)
- `examples/` — Integration samples
- `scripts/prepare.js` — Creates dist/package.json before the Parcel build

## Gotchas

- **Parcel bundler**: targets configured in `package.json` `"targets"`. Outputs: `dist/main/` (CJS), `dist/module/` (ESM), `dist/types/` (declarations), `dist/bundle/` (browser global).
- **The Visa script is Visa-hosted**: it is loaded by URL with the tenant's AppID and sets the `WebSDK` global synchronously; wait for the global, not the script `load` event.
- **Wire format**: the Basis Theory API uses snake_case (`token_id`, `encrypted_card_payload`); the SDK exposes camelCase.
- **Size limits**: `size-limit` in `package.json` caps the main and module targets.
- **Husky git hooks**: `husky install` runs on `prepare`. CI disables with `HUSKY=0`.
- **`yarn` not `npm`**: yarn classic with `yarn.lock`.
- **Version in package.json**: CI pins it from the release tag via `make update-version` before publish.

## Release

`deploy-dev.yml` runs on every push to master: build, then a `v*` tag and GitHub pre-release. Promoting the pre-release to a release triggers `release.yml`: verify the tag, build, `npm publish` with trusted publishing (OIDC, `PROD` environment), and commit the version back to master. Published as `@basis-theory/web-push-provisioning`.
