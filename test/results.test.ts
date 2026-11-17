import { mapProvisioningResult } from '~src/handlers/results';

describe('mapProvisioningResult', () => {
  it.each([
    ['VPPW_1200', 'success'],
    ['VPPW_1206', 'success'],
    ['VPPW_1201', 'unknown'],
    ['VPPW_110001', 'unknown'],
    ['VPPW_110002', 'unknown'],
    ['VPPW_1202', 'error'],
    ['VPPW_9999', 'error'],
  ])('maps the Apple result %s to %s', (code, status) => {
    expect(
      mapProvisioningResult(
        'APPLE',
        { result: { code, message: 'm' } },
        'session_VMCP'
      )
    ).toEqual({
      wallet: 'APPLE',
      success: status === 'success',
      status,
      code,
      message: 'm',
      codes: [code],
      nonFatalErrors: [],
      correlationId: 'session_VMCP',
    });
  });

  it.each([
    ['VPPW_2002', 'success'],
    ['VPPW_2003', 'success'],
    ['VPPW_2004', 'success'],
    ['VPPW_2005', 'partial'],
    ['VPPW_2006', 'partial'],
  ])('maps the Google result %s to %s', (code, status) => {
    expect(
      mapProvisioningResult('GOOGLE', {
        result: {
          resultCodes: [{ code, message: 'm' }],
          nonFatalErrors: [{ code: 'E1', message: 'n' }],
        },
      })
    ).toMatchObject({
      success: status === 'success',
      status,
      code,
      message: 'm',
      codes: [code],
      nonFatalErrors: [{ code: 'E1', message: 'n' }],
    });
  });

  it('maps an Apple error with its correlation id', () => {
    expect(
      mapProvisioningResult(
        'APPLE',
        {
          error: {
            code: 'VPPW_ERROR_1444',
            message: 'd',
            correlationId: 'abc_VMCP',
          },
        },
        'session_VMCP'
      )
    ).toEqual({
      wallet: 'APPLE',
      success: false,
      status: 'error',
      code: 'VPPW_ERROR_1444',
      message: 'd',
      codes: ['VPPW_ERROR_1444'],
      nonFatalErrors: [],
      correlationId: 'abc_VMCP',
    });
  });

  it('maps every Google error code and falls back to the session correlation id', () => {
    expect(
      mapProvisioningResult(
        'GOOGLE',
        {
          error: {
            errorCodes: [
              { code: 'VPPW_ERROR_2007', message: 'd' },
              { code: 'VPPW_ERROR_2305', message: 'e' },
            ],
          },
        },
        'session_VMCP'
      )
    ).toMatchObject({
      success: false,
      status: 'error',
      code: 'VPPW_ERROR_2007',
      message: 'd',
      codes: ['VPPW_ERROR_2007', 'VPPW_ERROR_2305'],
      correlationId: 'session_VMCP',
    });
  });

  it('reads the codes Visa reports when its legacy mapping is off', () => {
    expect(
      mapProvisioningResult('APPLE', { result: { code: 'VW_PP_1200' } })
    ).toMatchObject({ success: true, code: 'VW_PP_1200' });
    expect(
      mapProvisioningResult('APPLE', { result: { code: 'VW_PP_1201' } })
    ).toMatchObject({ status: 'unknown' });
  });

  it('never reports success for an error that carries a success code', () => {
    expect(
      mapProvisioningResult('APPLE', { error: { code: 'VPPW_1200' } })
    ).toMatchObject({ success: false, status: 'error' });
  });

  it('treats a missing or empty result as an error', () => {
    expect(mapProvisioningResult('APPLE', undefined)).toMatchObject({
      success: false,
      status: 'error',
      codes: [],
    });
    expect(
      mapProvisioningResult('GOOGLE', { result: { resultCodes: [] } })
    ).toMatchObject({ success: false, status: 'error', code: undefined });
  });
});
