import { Pool, QueryResult, QueryResultRow } from 'pg';

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || 'travelerp_lite',
        user: process.env.DB_USER || 'travelerp',
        password: process.env.DB_PASSWORD || 'travelerp123',
        max: 20, // 4-5 users, each with multiple connections
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
);

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function testConnection(): Promise<void> {
  await pool.query('SELECT 1');
}

export function getPool(): Pool {
  return pool;
}

export default pool;

