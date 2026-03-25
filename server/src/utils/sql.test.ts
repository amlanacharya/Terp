import { describe, it, expect } from 'vitest';
import { buildUpdateClause, pickDefinedFields } from './sql';

describe('buildUpdateClause', () => {
  it('generates named parameter SQL for SQLite', () => {
    const result = buildUpdateClause({ name: 'Alice', age: 30 });
    expect(result.clause).toBe('name = $name, age = $age');
    expect(result.params).toEqual({ name: 'Alice', age: 30 });
  });

  it('handles a single field', () => {
    const result = buildUpdateClause({ status: 'active' });
    expect(result.clause).toBe('status = $status');
    expect(result.params).toEqual({ status: 'active' });
  });
});

describe('pickDefinedFields', () => {
  it('keeps only allowed fields that are defined', () => {
    const result = pickDefinedFields(
      { name: 'Alice', age: undefined, extra: 'ignored' },
      ['name', 'age'] as const
    );
    expect(result).toEqual({ name: 'Alice' });
  });
});
