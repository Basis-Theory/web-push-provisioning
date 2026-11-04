import { mapProvisioningResult } from '~src/handlers/results';

describe('mapProvisioningResult', () => {
  it.each([
    ['VPPW_1200', 'success'],
    ['VPPW_1206', 'success'],
    ['VPPW_2002', 'success'],
    ['VPPW_2003', 'success'],
    ['VPPW_2004', 'success'],
    ['VPPW_2005', 'partial'],
    ['VPPW_2006', 'partial'],
    ['VPPW_9999', 'error'],
  ])('maps %s to %s', (code, status) => {
    expect(
      mapProvisioningResult('APPLE', {
        wallet: 'APPLE',
        code,
        message: 'm',
        correlationId: 'abc_VMCP',
      })
    ).toEqual({
      wallet: 'APPLE',
      success: status === 'success',
      status,
      code,
      message: 'm',
      correlationId: 'abc_VMCP',
    });
  });

  it('maps an error result and falls back to the session correlation id', () => {
    expect(
      mapProvisioningResult(
        'GOOGLE',
        { wallet: 'GOOGLE', error: { code: 'VPPW_ERROR_2007', message: 'd' } },
        'session_VMCP'
      )
    ).toEqual({
      wallet: 'GOOGLE',
      success: false,
      status: 'error',
      code: 'VPPW_ERROR_2007',
      message: 'd',
      correlationId: 'session_VMCP',
    });
  });

  it('treats a missing result as an error', () => {
    expect(mapProvisioningResult('APPLE', undefined)).toMatchObject({
      success: false,
      status: 'error',
    });
  });
});
