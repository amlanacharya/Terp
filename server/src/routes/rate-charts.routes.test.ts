import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, getDb, reconnect } from '../config/db';
import { signToken } from '../middleware/auth';
import { server, startServer } from '../index';

describe('rate-charts routes (SQLite)', () => {
  let baseUrl = '';

  beforeAll(async () => {
    process.env.FLEETSYNC_DB_PATH = ':memory:';
    reconnect(':memory:');
    await startServer(0);
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Server did not start on a TCP port.');
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    closeDb();
  });

  it('creates, extends, duplicates, and rejects overlapping active charts', async () => {
    const db = getDb();
    const adminId = randomUUID();
    const customerId = randomUUID();
    const vehicleCategoryId = randomUUID();

    db.prepare(
      `
        INSERT INTO profiles (
          id, email, password_hash, full_name, role, is_active, created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'), 1)
      `
    ).run(adminId, 'admin@example.com', 'seed', 'Admin User', 'admin');

    db.prepare(
      `
        INSERT INTO customers (
          id, customer_code, name, state, credit_limit, is_active, created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, 0, 1, datetime('now'), datetime('now'), 1)
      `
    ).run(customerId, 'CUST001', 'Test Customer', 'Odisha');

    db.prepare(
      `
        INSERT INTO vehicle_categories (
          id, name, description, is_active, created_at, updated_at, version
        ) VALUES (?, ?, ?, 1, datetime('now'), datetime('now'), 1)
      `
    ).run(vehicleCategoryId, 'CRYSTA', 'Seed');

    const token = signToken({
      id: adminId,
      email: 'admin@example.com',
      full_name: 'Admin User',
      role: 'admin',
    });

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const createResponse = await fetch(`${baseUrl}/api/rate-charts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer_id: customerId,
        name: 'Primary Chart',
        effective_from: '2026-01-01',
        is_active: true,
      }),
    });

    expect(createResponse.status).toBe(201);
    const createdChart = await createResponse.json();
    expect(createdChart.id).toBeTypeOf('string');

    const itemResponse = await fetch(`${baseUrl}/api/rate-charts/${createdChart.id}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        vehicle_category_id: vehicleCategoryId,
        duty_type: 'local',
        package_code: '8H80K',
        package_label: '8Hr/80Km',
        is_default: true,
        base_hours: 8,
        base_km: 80,
        base_amount: 3000,
        extra_km_rate: 18,
        extra_hr_rate: 180,
      }),
    });

    expect(itemResponse.status).toBe(201);
    const chartWithItem = await itemResponse.json();
    expect(chartWithItem.items).toHaveLength(1);

    const fixedRouteResponse = await fetch(`${baseUrl}/api/rate-charts/${createdChart.id}/fixed-routes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        vehicle_category_id: vehicleCategoryId,
        duty_type: 'drop_pickup',
        from_location: 'TSM',
        to_location: 'BBSR',
        fixed_amount: 4000,
      }),
    });

    expect(fixedRouteResponse.status).toBe(201);
    const chartWithFixedRoute = await fixedRouteResponse.json();
    expect(chartWithFixedRoute.fixed_routes).toHaveLength(1);

    const duplicateResponse = await fetch(`${baseUrl}/api/rate-charts/${createdChart.id}/duplicate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Primary Chart Copy',
        effective_from: '2026-02-01',
        is_active: false,
      }),
    });

    expect(duplicateResponse.status).toBe(201);
    const duplicatedChart = await duplicateResponse.json();
    expect(duplicatedChart.name).toBe('Primary Chart Copy');
    expect(duplicatedChart.items).toHaveLength(1);
    expect(duplicatedChart.fixed_routes).toHaveLength(1);
    expect(duplicatedChart.items[0].id).not.toBe(chartWithItem.items[0].id);
    expect(duplicatedChart.fixed_routes[0].id).not.toBe(chartWithFixedRoute.fixed_routes[0].id);

    const conflictResponse = await fetch(`${baseUrl}/api/rate-charts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer_id: customerId,
        name: 'Conflict Chart',
        effective_from: '2026-01-15',
        is_active: true,
      }),
    });

    expect(conflictResponse.status).toBe(409);
    await expect(conflictResponse.json()).resolves.toEqual({
      message: 'An overlapping active rate chart already exists for this customer.',
    });
  });
});
