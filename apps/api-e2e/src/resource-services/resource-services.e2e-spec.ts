import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const baseURL = process.env.NX_BASE_URL ?? 'http://localhost:3000';
const TENANT = process.env.E2E_TENANT_SLUG!;
const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;
const RESOURCE_ID = process.env.E2E_RESOURCE_ID!;
const SERVICE_ID = process.env.E2E_SERVICE_ID!;
const OTHER_TENANT = process.env.E2E_OTHER_TENANT_SLUG!;

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

describe('ResourceService link (e2e)', () => {
  let token: string;

  beforeAll(async () => {
    token = await login();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('lists services for a resource (seed link exists)', async () => {
    const res = await axios.get(`${baseURL}/api/resources/${RESOURCE_ID}/services`, {
      headers: headers(token),
    });

    expect(Array.isArray(res.data.items)).toBe(true);
    expect(res.data.items.some((x: any) => x.service?.id === SERVICE_ID)).toBe(true);
  });

  it('links + prevents duplicate (409 RESOURCE_SERVICE_ALREADY_LINKED)', async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT } });
    if (!tenant) throw new Error('Missing tenant e2e in DB');

    const location = await prisma.location.findFirst({ where: { tenantId: tenant.id } });
    if (!location) throw new Error('Missing location e2e in DB');

    const resource = await prisma.resource.create({
      data: {
        tenantId: tenant.id,
        locationId: location.id,
        name: `LinkRes ${Date.now()}`,
        kind: 'STAFF',
        isActive: true,
      },
    });

    const service = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        locationId: location.id,
        name: `LinkSvc ${Date.now()}`,
        durationMinutes: 30,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        isActive: true,
      },
    });

    const linked = await axios.post(
      `${baseURL}/api/resource-services`,
      { resourceId: resource.id, serviceId: service.id },
      { headers: headers(token) },
    );

    expect(linked.data.resourceId).toBe(resource.id);
    expect(linked.data.serviceId).toBe(service.id);

    await expect(
      axios.post(
        `${baseURL}/api/resource-services`,
        { resourceId: resource.id, serviceId: service.id },
        { headers: headers(token) },
      ),
    ).rejects.toMatchObject({
      response: { status: 409, data: { code: 'RESOURCE_SERVICE_ALREADY_LINKED' } },
    });

    await prisma.resourceService.deleteMany({
      where: { tenantId: tenant.id, resourceId: resource.id, serviceId: service.id },
    });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.resource.delete({ where: { id: resource.id } });
  });

  it('tenant isolation: cannot list links using another tenant slug (401 Invalid tenant)', async () => {
    await expect(
      axios.get(`${baseURL}/api/resources/${RESOURCE_ID}/services`, {
        headers: headers(token, OTHER_TENANT),
      }),
    ).rejects.toMatchObject({
      response: {
        status: 401,
        data: {
          code: 'INVALID_TENANT',
          message: 'Invalid tenant',
        },
      },
    });
  });

  it('unlinks by id', async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT } });
    if (!tenant) throw new Error('Missing tenant e2e in DB');

    const location = await prisma.location.findFirst({ where: { tenantId: tenant.id } });
    if (!location) throw new Error('Missing location e2e in DB');

    const resource = await prisma.resource.create({
      data: {
        tenantId: tenant.id,
        locationId: location.id,
        name: `UnlinkRes ${Date.now()}`,
        kind: 'STAFF',
        isActive: true,
      },
    });

    const service = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        locationId: location.id,
        name: `UnlinkSvc ${Date.now()}`,
        durationMinutes: 15,
        isActive: true,
      },
    });

    const link = await axios.post(
      `${baseURL}/api/resource-services`,
      { resourceId: resource.id, serviceId: service.id },
      { headers: headers(token) },
    );

    const linkId = link.data.id;

    const del = await axios.delete(`${baseURL}/api/resource-services/${linkId}`, {
      headers: headers(token),
    });

    expect(del.data.success).toBe(true);

    await prisma.service.delete({ where: { id: service.id } });
    await prisma.resource.delete({ where: { id: resource.id } });
  });
});