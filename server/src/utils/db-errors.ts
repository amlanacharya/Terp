interface PgLikeError {
  code?: string;
}

export function getDeleteErrorMessage(entity: string, error: unknown): string {
  const pgError = error as PgLikeError | undefined;

  if (pgError?.code === '23503') {
    return `Cannot delete ${entity} - linked records exist.`;
  }

  return `Unable to delete ${entity}.`;
}
