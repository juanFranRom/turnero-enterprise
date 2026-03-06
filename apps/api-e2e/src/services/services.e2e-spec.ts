import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const baseURL = process.env.NX_BASE_URL ?? 'http://localhost:3000';
const TENANT = process.env.E2E_TENANT_SLUG!;
const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;
const LOCATION_ID = process.env.E2E_LOCATION_ID!;
const OTHER_TENANT = process.env.E2E_OTHER_TENANT_SLUG!;
const OTHER_LOCATION_ID = process.env.E2E_OTHER_LOCATION_ID!;

async function login() {
  const res = await axios.post(
    `${baseURL}/api/auth/login`,
    { email: EMAIL, password: PASSWORD },
    { headers: { 'X-Tenant-Slug': TENANT, 'x-e2e': '1' } },
  );
  return res.data.accessToken as string;
}

function headers(token: string, tenantSlug = TENANT) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Tenant-Slug': tenantSlug,
    'x-e2e': '1',
  };
}

describe('Services CRUD (e2e)', () => {
  let token: string;

  beforeAll(async () => {
    token = await login();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates + lists + gets + updates + soft deletes', async () => {
    const name = `Service ${Date.now()}`;

    const created = await axios.post(
      `${baseURL}/api/services`,
      {
        locationId: LOCATION_ID,
        name,
        description: 'Test service',
        durationMinutes: 30,
        bufferBeforeMinutes: 5,
        bufferAfterMinutes: 5,
      },
      { headers: headers(token) },
    );

    const id = created.data.id;
    expect(created.data.name).toBe(name);
    expect(created.data.locationId).toBe(LOCATION_ID);
    expect(created.data.isActive).toBe(true);

    const list = await axios.get(
      `${baseURL}/api/services?locationId=${encodeURIComponent(LOCATION_ID)}`,
      { headers: headers(token) },
    );
    expect(Array.isArray(list.data.items)).toBe(true);
    expect(list.data.items.some((s: any) => s.id === id)).toBe(true);

    const got = await axios.get(`${baseURL}/api/services/${id}`, {
      headers: headers(token),
    });
    expect(got.data.id).toBe(id);

    const upd = await axios.patch(
      `${baseURL}/api/services/${id}`,
      { name: `${name} Updated`, durationMinutes: 45 },
      { headers: headers(token) },
    );
    expect(upd.data.name).toBe(`${name} Updated`);
    expect(upd.data.durationMinutes).toBe(45);

    const del = await axios.delete(`${baseURL}/api/services/${id}`, {
      headers: headers(token),
    });
    expect(del.data.isActive).toBe(false);
  });

  it('validates locationId belongs to tenant (404 LOCATION_NOT_FOUND)', async () => {
    const name = `Wrong Location ${Date.now()}`;

    await expect(
      axios.post(
        `${baseURL}/api/services`,
        { locationId: OTHER_LOCATION_ID, name, durationMinutes: 30 },
        { headers: headers(token) },
      ),
    ).rejects.toMatchObject({
      response: { status: 404, data: { code: 'LOCATION_NOT_FOUND' } },
    });
  });

  it('tenant isolation: cannot read service from another tenant (401 Invalid tenant)', async () => {
    const name = `Isolation ${Date.now()}`;

    const created = await axios.post(
      `${baseURL}/api/services`,
      { locationId: LOCATION_ID, name, durationMinutes: 30 },
      { headers: headers(token) },
    );

    const id = created.data.id;

    await expect(
      axios.get(`${baseURL}/api/services/${id}`, {
        headers: headers(token, OTHER_TENANT),
      }),
    ).rejects.toMatchObject({
      response: {
        status: 401,
        data: {
          statusCode: 401,
          message: 'Invalid tenant',
          error: 'Unauthorized',
        },
      },
    });
  });

  it('enforces unique name per (tenantId, locationId, name) (409 SERVICE_NAME_TAKEN)', async () => {
    const name = `Dup ${Date.now()}`;

    const s1 = await axios.post(
      `${baseURL}/api/services`,
      { locationId: LOCATION_ID, name, durationMinutes: 30 },
      { headers: headers(token) },
    );

    await expect(
      axios.post(
        `${baseURL}/api/services`,
        { locationId: LOCATION_ID, name, durationMinutes: 30 },
        { headers: headers(token) },
      ),
    ).rejects.toMatchObject({
      response: { status: 409, data: { code: 'SERVICE_NAME_TAKEN' } },
    });

    await axios.delete(`${baseURL}/api/services/${s1.data.id}`, {
      headers: headers(token),
    });
  });
});