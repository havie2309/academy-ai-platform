import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { Pool, type QueryResult, type QueryResultRow } from 'pg'

function postgresHost(): string {
  const host = process.env.POSTGRES_HOST?.trim() ?? '127.0.0.1'
  return host === 'localhost' ? '127.0.0.1' : host
}

function createPool(): Pool {
  return new Pool({
    host: postgresHost(),
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'pm2',
    user: process.env.POSTGRES_USER ?? 'pm2_user',
    password: process.env.POSTGRES_PASSWORD ?? 'pm2pass',
  })
}

let sharedPool: Pool | null = null

export function getSharedPostgresPool(): Pool {
  if (!sharedPool) {
    sharedPool = createPool()
  }
  return sharedPool
}

@Injectable()
export class PostgresService implements OnModuleDestroy {
  private readonly pool = getSharedPostgresPool()

  get client(): Pool {
    return this.pool
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params)
  }

  async onModuleDestroy() {
    if (sharedPool) {
      await sharedPool.end().catch(() => {})
      sharedPool = null
    }
  }
}
