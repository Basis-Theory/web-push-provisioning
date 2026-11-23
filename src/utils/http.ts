import {
  API_BASE_URL,
  API_ENVIRONMENTS,
  BT_API_KEY_HEADER_NAME,
  BT_CORRELATION_ID_HEADER_NAME,
  REGIONAL_API_BASE_URLS,
} from '~src/constants';
import type { Logger } from './logging';

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

const resolveApiEnv = (baseUrl?: string): string | undefined => {
  try {
    const host = new URL(baseUrl ?? API_BASE_URL).hostname;

    return API_ENVIRONMENTS.find(([suffix]) => host.endsWith(suffix))?.[1];
  } catch {
    return undefined;
  }
};

type HttpClient = {
  post: (
    path: string,
    body?: unknown,
    correlationId?: string
  ) => Promise<Response>;
};

const createHttpClient = (
  apiKey: string,
  logger: Logger,
  baseUrl?: string
): HttpClient => {
  if (!apiKey) {
    throw Error('Missing api key');
  }

  const request = async (
    method: string,
    path: string,
    body?: unknown,
    correlationId?: string
  ) => {
    if (baseUrl) {
      void logger.log.info(`Using custom api base url ${baseUrl}`);
    }

    const headers: Record<string, string> = {
      [BT_API_KEY_HEADER_NAME]: apiKey,
      'Content-Type': 'application/json',
    };

    if (correlationId) {
      headers[BT_CORRELATION_ID_HEADER_NAME] = correlationId;
    }

    return await fetch(`${baseUrl ?? API_BASE_URL}${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
    });
  };

  return {
    post: (path, body, correlationId) =>
      request('POST', path, body, correlationId),
  };
};

export { createHttpClient, resolveApiBaseUrlOverride, resolveApiEnv };
export type { HttpClient };
