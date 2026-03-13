import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const baseURL = process.env.NX_BASE_URL ?? 'http://localhost:3000';
const TENANT = process.env.E2E_TENANT_SLUG!;
const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;
const LOCATION_ID = process.env.E2E_LOCATION_ID!;
const RESOURCE_ID = process.env.E2E_RESOURCE_ID!;
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

describe('WeeklySchedules CRUD (e2e)', () => {
  let token: string;

  beforeAll(async () => {
    token = await login();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates + lists + gets + updates + deletes', async () => {
    const created = await axios.post(
      `${baseURL}/api/weekly-schedules`,
      {
        locationId: LOCATION_ID,
        resourceId: RESOURCE_ID,
        dayOfWeek: 2,
        startTime: '14:00',
        endTime: '16:00',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
      },
      { headers: headers(token) },
    );

    const id = created.data.id;

    const list = await axios.get(
      `${baseURL}/api/weekly-schedules?resourceId=${encodeURIComponent(RESOURCE_ID)}&dayOfWeek=2`,
      { headers: headers(token) },
    );

    expect(Array.isArray(list.data.items)).toBe(true);
    expect(list.data.items.some((x: any) => x.id === id)).toBe(true);

    const got = await axios.get(`${baseURL}/api/weekly-schedules/${id}`, {
      headers: headers(token),
    });
    expect(got.data.id).toBe(id);

    const upd = await axios.patch(
      `${baseURL}/api/weekly-schedules/${id}`,
      { startTime: '14:30', endTime: '16:30' },
      { headers: headers(token) },
    );
    
    expect(new Date(upd.data.startTime).toISOString()).toBe('1970-01-01T14:30:00.000Z');

    const del = await axios.delete(`${baseURL}/api/weekly-schedules/${id}`, {
      headers: headers(token),
    });
    expect(del.data.success).toBe(true);
  });

  it('rejects invalid time range (400 INVALID_TIME_RANGE)', async () => {
    await expect(
      axios.post(
        `${baseURL}/api/weekly-schedules`,
        {
          locationId: LOCATION_ID,
          resourceId: RESOURCE_ID,
          dayOfWeek: 3,
          startTime: '16:00',
          endTime: '15:00',
        },
        { headers: headers(token) },
      ),
    ).rejects.toMatchObject({
      response: { status: 400, data: { code: 'INVALID_TIME_RANGE' } },
    });
  });

  it('validates locationId belongs to tenant (404 LOCATION_NOT_FOUND)', async () => {
    await expect(
      axios.post(
        `${baseURL}/api/weekly-schedules`,
        {
          locationId: OTHER_LOCATION_ID,
          resourceId: RESOURCE_ID,
          dayOfWeek: 4,
          startTime: '10:00',
          endTime: '11:00',
        },
        { headers: headers(token) },
      ),
    ).rejects.toMatchObject({
      response: { status: 404, data: { code: 'LOCATION_NOT_FOUND' } },
    });
  });

  it('tenant isolation: cannot read schedule from another tenant (401 Invalid tenant)', async () => {
    const created = await axios.post(
      `${baseURL}/api/weekly-schedules`,
      {
        locationId: LOCATION_ID,
        resourceId: RESOURCE_ID,
        dayOfWeek: 5,
        startTime: '09:00',
        endTime: '10:00',
      },
      { headers: headers(token) },
    );

    const id = created.data.id;

    await expect(
      axios.get(`${baseURL}/api/weekly-schedules/${id}`, {
        headers: headers(token, OTHER_TENANT),
      }),
    ).rejects.toMatchObject({
      response: {
        status: 401,
        data: {
          code: 'TENANT_MEMBERSHIP_REQUIRED',
          message: 'User not a member of this tenant',
        },
      },
    });

    await axios.delete(`${baseURL}/api/weekly-schedules/${id}`, {
      headers: headers(token),
    });
  });

  it('rejects resource-location mismatch (400 RESOURCE_LOCATION_MISMATCH)', async () => {
    const otherSameTenantLocation = await axios.post(
      `${baseURL}/api/locations`,
      {
        name: `Other same-tenant location ${Date.now()}`,
        timeZone: 'America/Argentina/San_Luis',
      },
      { headers: headers(token) },
    );

    const sameTenantLocationId = otherSameTenantLocation.data.id;

    await expect(
      axios.post(
        `${baseURL}/api/weekly-schedules`,
        {
          locationId: sameTenantLocationId,
          resourceId: RESOURCE_ID,
          dayOfWeek: 6,
          startTime: '10:00',
          endTime: '11:00',
        },
        { headers: headers(token) },
      ),
    ).rejects.toMatchObject({
      response: { status: 400, data: { code: 'RESOURCE_LOCATION_MISMATCH' } },
    });
  });
});