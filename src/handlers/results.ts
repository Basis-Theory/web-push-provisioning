import {
  PROVISIONING_PARTIAL_CODES,
  PROVISIONING_SUCCESS_CODES,
  Wallet,
} from '~src/constants';
import type { VisaProvisioningResult } from '~src/handlers/visaSdk';

export type ProvisioningStatus = 'success' | 'partial' | 'error';

export type ProvisioningResult = {
  wallet: Wallet;
  /**
   * `true` only when Visa reported the card as added to the wallet.
   */
  success: boolean;
  status: ProvisioningStatus;
  /**
   * Visa result or error code, for example `VPPW_1200` or `VPPW_ERROR_2007`.
   */
  code?: string;
  message?: string;
  /**
   * Visa correlation id (`xxxxxxxx_VMCP`). Log it: Visa support needs it.
   */
  correlationId?: string;
};

const includes = (codes: readonly string[], code?: string): boolean =>
  code !== undefined && codes.includes(code);

const statusOf = (result: VisaProvisioningResult): ProvisioningStatus => {
  if (result.error) {
    return 'error';
  }
  if (includes(PROVISIONING_SUCCESS_CODES, result.code)) {
    return 'success';
  }
  if (includes(PROVISIONING_PARTIAL_CODES, result.code)) {
    return 'partial';
  }

  return 'error';
};

export const mapProvisioningResult = (
  wallet: Wallet,
  result: VisaProvisioningResult | undefined,
  fallbackCorrelationId?: string
): ProvisioningResult => {
  const raw = result ?? {};
  const status = statusOf(raw);
  const source = raw.error ?? raw;

  return {
    wallet,
    success: status === 'success',
    status,
    code: source.code,
    message: source.message,
    correlationId:
      source.correlationId ?? raw.correlationId ?? fallbackCorrelationId,
  };
};
