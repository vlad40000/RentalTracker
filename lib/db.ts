import { Pool, type QueryResultRow } from "@neondatabase/serverless";

export type DbClient = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
};

let pool: Pool | undefined;

export function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  pool ??= new Pool({ connectionString: url });
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, values);
  return result.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T> {
  const rows = await query<T>(text, values);
  if (rows.length !== 1) throw new Error(`Expected one row, received ${rows.length}`);
  return rows[0];
}

export async function maybeOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, values);
  if (rows.length > 1) throw new Error(`Expected zero or one row, received ${rows.length}`);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
