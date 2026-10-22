type ApiError = {
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
};

type BasisTheoryPushProvisioningError = Error & {
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
};

const isApiError = (error: unknown): error is ApiError =>
  typeof error === 'object' &&
  error !== null &&
  ('title' in error || 'status' in error || 'detail' in error);

const createError = (apiError: ApiError): BasisTheoryPushProvisioningError => {
  const message =
    apiError.detail || apiError.title || 'An unknown error occurred';

  const error = new Error(message) as BasisTheoryPushProvisioningError;
  error.name = 'BasisTheoryPushProvisioningError';
  error.title = apiError.title;
  error.status = apiError.status;
  error.detail = apiError.detail;
  error.errors = apiError.errors;

  return error;
};

const processApiError = (apiError: ApiError): never => {
  throw createError(apiError);
};

export { isApiError, processApiError };
export type { ApiError, BasisTheoryPushProvisioningError };
