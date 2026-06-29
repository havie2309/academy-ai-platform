const DEFAULT_ETL_INTERNAL_AUTH_HEADER = 'x-etl-internal-secret';

export interface EtlInternalAuthConfig {
  headerName: string;
  sharedSecret: string;
}

export function resolveEtlInternalAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): EtlInternalAuthConfig {
  const headerName =
    env.ETL_INTERNAL_AUTH_HEADER?.trim() || DEFAULT_ETL_INTERNAL_AUTH_HEADER;
  const sharedSecret = env.ETL_INTERNAL_SHARED_SECRET?.trim() || '';
  return { headerName, sharedSecret };
}

export function attachEtlInternalAuthHeaders(
  setHeader: (name: string, value: string) => void,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const { headerName, sharedSecret } = resolveEtlInternalAuthConfig(env);
  if (!sharedSecret) {
    return;
  }
  setHeader(headerName, sharedSecret);
}
