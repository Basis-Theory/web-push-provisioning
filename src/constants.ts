export const BT_API_KEY_HEADER_NAME = 'BT-API-KEY';

export const BT_CORRELATION_ID_HEADER_NAME = 'BT-TRACE-ID';

export const API_BASE_URL = 'https://api.basistheory.com';

export const REGIONAL_API_BASE_URLS: Record<string, string> = {
  eu: 'https://api.eu.basistheory.com',
  us: 'https://api.us.basistheory.com',
};

export const PUSH_PROVISIONING_PATH = '/push-provisioning';

export const ENVIRONMENTS = ['sandbox', 'production'] as const;

export type Environment = (typeof ENVIRONMENTS)[number];

export const VISA_SDK_BASE_URLS: Record<Environment, string> = {
  sandbox: 'https://sbx.digitalcardservice.com/web-sdk/V1/web_sdk.js',
  production: 'https://js.digitalcardservice.com/web-sdk/V1/web_sdk.js',
};

export const VISA_SDK_GLOBAL_NAME = 'WebSDK';
