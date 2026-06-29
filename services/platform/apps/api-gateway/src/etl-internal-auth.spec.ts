import {
  attachEtlInternalAuthHeaders,
  resolveEtlInternalAuthConfig,
} from './etl-internal-auth';

describe('etl-internal-auth', () => {
  it('uses the default internal ETL header name', () => {
    expect(resolveEtlInternalAuthConfig({} as NodeJS.ProcessEnv)).toEqual({
      headerName: 'x-etl-internal-secret',
      sharedSecret: '',
    });
  });

  it('attaches the ETL internal secret header when configured', () => {
    const headers = new Map<string, string>();
    attachEtlInternalAuthHeaders(
      (name, value) => headers.set(name, value),
      {
        ETL_INTERNAL_AUTH_HEADER: 'x-gateway-etl-secret',
        ETL_INTERNAL_SHARED_SECRET: 'spec-secret',
      } as NodeJS.ProcessEnv,
    );

    expect(headers.get('x-gateway-etl-secret')).toBe('spec-secret');
  });

  it('does not attach any ETL internal header when the secret is empty', () => {
    const headers = new Map<string, string>();
    attachEtlInternalAuthHeaders(
      (name, value) => headers.set(name, value),
      {
        ETL_INTERNAL_SHARED_SECRET: '   ',
      } as NodeJS.ProcessEnv,
    );

    expect(headers.size).toBe(0);
  });
});
