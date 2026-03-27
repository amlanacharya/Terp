declare module '../server/dist/config/db.js' {
  import { QueryResult, QueryResultRow } from 'pg';
  export function query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
  export function testConnection(): Promise<void>;
  export default any;
}

declare module '../server/dist/utils/product-key.js' {
  export interface ProductKeyInfo {
    subscriptionType: 'monthly' | 'quarterly' | 'annual';
    issueDate: string;
  }

  export function generateProductKey(
    subscriptionType: 'monthly' | 'quarterly' | 'annual',
    issueDate: string
  ): string;

  export function validateProductKey(key: string): boolean;

  export function decodeProductKey(key: string): ProductKeyInfo;

  export function hashProductKey(key: string): string;
}
