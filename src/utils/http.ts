import {
  API_BASE_URL,
  BT_API_KEY_HEADER_NAME,
  BT_CORRELATION_ID_HEADER_NAME,
  REGIONAL_API_BASE_URLS,
} from '~src/constants';
import { logger } from './logging';

const resolveApiBaseUrlOverride = (options?: {
  apiBaseUrl?: string;
  region?: string;
}): string | undefined => {
  if (options?.apiBaseUrl) {
    return options.apiBaseUrl;
  }

  const region = options?.region?.toLowerCase();

  return (region && REGIONAL_API_BASE_URLS[region]) || undefined;
};

const http = (() => {
  let _apiKey: string;
  let _baseUrl: string | undefined;

  const client = async (
    method: string,
    path: string,
    body?: unknown,
    correlationId?: string
  ) => {
    if (!_apiKey) {
      throw Error('Missing api key');
    }

    if (_baseUrl) {
      void logger.log.info(`Using custom api base url ${_baseUrl}`);
    }

    const headers: Record<string, string> = {
      [BT_API_KEY_HEADER_NAME]: _apiKey,
      'Content-Type': 'application/json',
    };

    if (correlationId) {
      headers[BT_CORRELATION_ID_HEADER_NAME] = correlationId;
    }

    return await fetch(`${_baseUrl ?? API_BASE_URL}${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
    });
  };

  return {
    init: (apiKey: string, baseUrl?: string) => {
      _apiKey = apiKey;
      _baseUrl = baseUrl;
    },
    post: (path: string, body?: unknown, correlationId?: string) =>
      client('POST', path, body, correlationId),
  };
})();

export { http, resolveApiBaseUrlOverride };
