import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.resolve(here, '../../dist/bundle/index.js');

const required = (name) => {
  const value = process.env[name];

  if (!value) {
    console.error(`Environment variable '${name}' is required`);
    process.exit(1);
  }

  return value;
};

const port = Number(process.env.PORT || 4173);
const apiBaseUrl = (
  process.env.BT_API_URL || 'https://api.test.basistheory.com'
).replace(/\/$/u, '');
const publicApiKey = required('BT_PUBLIC_API_KEY');
const privateApiKey = required('BT_PRIVATE_API_KEY');
const environment = process.env.PUSH_PROVISIONING_ENVIRONMENT || 'mock';
const mockSignatureSecret =
  environment === 'mock'
    ? required('PUSH_PROVISIONING_SIGNATURE_SECRET')
    : undefined;
const appId = environment === 'mock' ? undefined : required('VISA_APP_ID');

const basisTheory = async (pathname, body) => {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method: 'POST',
    headers: {
      'BT-API-KEY': privateApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `POST ${pathname} failed with ${response.status}: ${await response.text()}`
    );
  }

  return response;
};

const createCardToken = async () => {
  const response = await basisTheory('/tokens', {
    type: 'card',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    data: {
      number: '4111111111111111',
      expiration_month: 12,
      expiration_year: new Date().getFullYear() + 2,
      cvc: '123',
      cardholder_name: 'Jane Doe',
      billing_address: {
        line1: '5 Central Drive',
        city: 'Austin',
        state_code: 'TX',
        postal_code: '78757',
        country_code: 'US',
        phone_number: '+1-512-555-0100',
      },
    },
  });

  return (await response.json()).id;
};

let cardTokenId;
const getCardTokenId = () => {
  cardTokenId ??= process.env.CARD_TOKEN_ID
    ? Promise.resolve(process.env.CARD_TOKEN_ID)
    : createCardToken().catch((error) => {
        cardTokenId = undefined;
        throw error;
      });

  return cardTokenId;
};

const authorizeSession = async (nonce) => {
  await basisTheory('/sessions/authorize', {
    nonce,
    rules: [
      {
        description: 'Push provisioning for one card',
        priority: 1,
        transform: 'reveal',
        permissions: ['token:use'],
        conditions: [
          {
            attribute: 'id',
            operator: 'equals',
            value: await getCardTokenId(),
          },
        ],
      },
    ],
  });
};

const readJson = async (request) => {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
};

const sendJson = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
};

const sendFile = async (response, file, contentType) => {
  response.writeHead(200, { 'Content-Type': contentType });
  response.end(await readFile(file));
};

const routes = {
  'GET /': (_request, response) =>
    sendFile(response, path.join(here, 'index.html'), 'text/html'),
  'GET /wallet.js': (_request, response) =>
    sendFile(response, path.join(here, 'wallet.js'), 'text/javascript'),
  'GET /sdk.js': (_request, response) =>
    sendFile(response, bundlePath, 'text/javascript'),
  'GET /config': async (_request, response) =>
    sendJson(response, 200, {
      apiBaseUrl,
      publicApiKey,
      environment,
      appId,
      mockSignatureSecret,
      cardTokenId: await getCardTokenId(),
    }),
  'POST /authorize-session': async (request, response) => {
    const { nonce } = await readJson(request);

    if (typeof nonce !== 'string' || !nonce) {
      sendJson(response, 400, { error: 'nonce is required' });

      return;
    }

    await authorizeSession(nonce);
    response.writeHead(204).end();
  },
};

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  const route = routes[`${request.method} ${pathname}`];

  if (!route) {
    sendJson(response, 404, { error: 'Not found' });

    return;
  }

  try {
    await route(request, response);
  } catch (error) {
    console.error(error);

    if (!response.headersSent) {
      sendJson(response, 500, {
        error:
          error.code === 'ENOENT'
            ? 'Bundle not found. Run `yarn build` first.'
            : error.message,
      });
    } else {
      response.end();
    }
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Wallet example listening on http://127.0.0.1:${port}`);
});
