export function pickDefinedFields(
  source: Record<string, unknown>,
  allowedFields: readonly string[]
): Record<string, unknown> {
  return allowedFields.reduce<Record<string, unknown>>((accumulator, field) => {
    const value = source[field];
    if (value !== undefined) {
      accumulator[field] = value;
    }
    return accumulator;
  }, {});
}

export function buildUpdateClause(fields: Record<string, unknown>): {
  clause: string;
  values: unknown[];
} {
  const entries = Object.entries(fields);
  return {
    clause: entries.map(([key], index) => `${key} = $${index + 1}`).join(', '),
    values: entries.map(([, value]) => value),
  };
}
