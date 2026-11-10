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

/**
 * An error raised by the Visa web SDK. `code` is Visa's error code
 * (`VDC_ERROR_*`, `VPPW_ERROR_*`, `VW_ERROR_*`) and `correlationId` is the
 * reference Visa support asks for.
 */
type VisaSdkError = Error & {
  code?: string;
  correlationId?: string;
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

const toVisaSdkError = (cause: unknown): VisaSdkError => {
  const source = (
    typeof cause === 'object' && cause !== null ? cause : {}
  ) as Partial<VisaSdkError>;
  const message =
    typeof source.message === 'string' && source.message
      ? source.message
      : typeof cause === 'string'
        ? cause
        : 'The Visa web SDK reported an error';

  const error = (
    cause instanceof Error ? cause : new Error(message)
  ) as VisaSdkError;
  error.name = 'VisaSdkError';
  error.code = typeof source.code === 'string' ? source.code : undefined;
  error.correlationId =
    typeof source.correlationId === 'string' ? source.correlationId : undefined;

  return error;
};

export { isApiError, processApiError, toVisaSdkError };
export type { ApiError, BasisTheoryPushProvisioningError, VisaSdkError };
