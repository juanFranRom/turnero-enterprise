import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const baseURL = process.env.NX_BASE_URL ?? 'http://localhost:3000';
const TENANT = process.env.E2E_TENANT_SLUG!;
const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;
const OTHER_TENANT = process.env.E2E_OTHER_TENANT_SLUG!;

async function login() {
  const res = await axios.post(
    `${baseURL}/api/auth/login`,
    { email: EMAIL, password: PASSWORD },
    { headers: { 'X-Tenant-Slug': TENANT, 'x-e2e': '1' } },
  );
  return res.data.accessToken as string;
}

describe('Locations CRUD (e2e)', () => {
  let token: string;

  beforeAll(async () => {
    token = await login();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates + lists + gets + updates + soft deletes', async () => {
    const name = `Main ${Date.now()}`;

    const created = await axios.post(
      `${baseURL}/api/locations`,
      { name, timeZone: 'America/Argentina/San_Luis' },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Slug': TENANT,
          'x-e2e': '1',
        },
      },
    );

    const id = created.data.id;

    const list1 = await axios.get(`${baseURL}/api/locations?limit=10`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': TENANT,
        'x-e2e': '1',
      },
    });

    expect(list1.data.items.some((x: any) => x.id === id)).toBe(true);

    const get1 = await axios.get(`${baseURL}/api/locations/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': TENANT,
        'x-e2e': '1',
      },
    });
    expect(get1.data.name).toBe(name);

    const upd = await axios.patch(
      `${baseURL}/api/locations/${id}`,
      { name: `${name} Updated`, isActive: true },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Slug': TENANT,
          'x-e2e': '1',
        },
      },
    );
    expect(upd.data.name).toBe(`${name} Updated`);

    const del = await axios.delete(`${baseURL}/api/locations/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': TENANT,
        'x-e2e': '1',
      },
    });
    expect(del.data.isActive).toBe(false);
  });

  it('validates timezone (400 INVALID_TIMEZONE)', async () => {
    const name = `Bad TZ ${Date.now()}`;

    await expect(
      axios.post(
        `${baseURL}/api/locations`,
        { name, timeZone: 'Mars/Olympus' },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Tenant-Slug': TENANT,
            'x-e2e': '1',
          },
        },
      ),
    ).rejects.toMatchObject({
      response: { status: 400, data: { code: 'INVALID_TIMEZONE' } },
    });
  });

  it('tenant isolation: cannot read location from another tenant (401 Invalid tenant)', async () => {
    const name = `Isolation ${Date.now()}`;

    const created = await axios.post(
      `${baseURL}/api/locations`,
      { name, timeZone: 'UTC' },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Slug': TENANT,
          'x-e2e': '1',
        },
      },
    );

    const id = created.data.id;

    await expect(
      axios.get(`${baseURL}/api/locations/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Slug': OTHER_TENANT,
          'x-e2e': '1',
        },
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
});