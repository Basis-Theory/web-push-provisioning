import {
  PROVISIONING_PARTIAL_CODES,
  PROVISIONING_SUCCESS_CODES,
  PROVISIONING_UNKNOWN_CODES,
  Wallet,
} from '~src/constants';
import type {
  VisaProvisioningResult,
  VisaResultCode,
} from '~src/handlers/visaSdk';

export type ProvisioningStatus = 'success' | 'partial' | 'unknown' | 'error';

export type ProvisioningResult = {
  wallet: Wallet;
  /**
   * `true` only when Visa reported the card as added to the wallet.
   */
  success: boolean;
  /**
   * `unknown` means Visa could not confirm the outcome and the card may still
   * be added to the device; ask the cardholder to check before retrying.
   */
  status: ProvisioningStatus;
  /**
   * First Visa result or error code, for example `VPPW_1200` or
   * `VPPW_ERROR_2007`.
   */
  code?: string;
  message?: string;
  /**
   * Every code Visa reported. Google Wallet can report more than one.
   */
  codes: string[];
  /**
   * Problems Google Wallet reported alongside a result that still went
   * through.
   */
  nonFatalErrors: VisaResultCode[];
  /**
   * Visa correlation id (`xxxxxxxx_VMCP`). Log it: Visa support needs it.
   */
  correlationId?: string;
};

const includes = (codes: readonly string[], code?: string): boolean =>
  code !== undefined && codes.includes(code);

const statusOf = (code?: string): ProvisioningStatus => {
  if (includes(PROVISIONING_SUCCESS_CODES, code)) {
    return 'success';
  }
  if (includes(PROVISIONING_PARTIAL_CODES, code)) {
    return 'partial';
  }
  if (includes(PROVISIONING_UNKNOWN_CODES, code)) {
    return 'unknown';
  }

  return 'error';
};

const reported = (entries: (VisaResultCode | undefined)[]): VisaResultCode[] =>
  entries.filter((entry): entry is VisaResultCode =>
    Boolean(entry?.code || entry?.message)
  );

export const mapProvisioningResult = (
  wallet: Wallet,
  result: VisaProvisioningResult | undefined,
  fallbackCorrelationId?: string
): ProvisioningResult => {
  const raw = result ?? {};
  const { error } = raw;
  // The mock deployed before it matched Visa reports the result unwrapped.
  const outcome = raw.result ?? raw;

  const entries = reported(
    error ? (error.errorCodes ?? [error]) : (outcome.resultCodes ?? [outcome])
  );
  const [first] = entries;
  const status = error ? 'error' : statusOf(first?.code);

  return {
    wallet,
    success: status === 'success',
    status,
    code: first?.code,
    message: first?.message,
    codes: entries.flatMap((entry) => (entry.code ? [entry.code] : [])),
    nonFatalErrors: error ? [] : reported(outcome.nonFatalErrors ?? []),
    correlationId:
      error?.correlationId ?? outcome.correlationId ?? fallbackCorrelationId,
  };
};
