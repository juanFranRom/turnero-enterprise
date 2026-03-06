import axios from 'axios';
import { PrismaClient } from '@prisma/client';

describe('AppointmentHistory endpoints (e2e)', () => {
  const baseURL = process.env.NX_BASE_URL ?? 'http://localhost:3000';
  const client = axios.create({ baseURL });
  const prisma = new PrismaClient();

  const tenantSlug = process.env.E2E_TENANT_SLUG!;
  const email = process.env.E2E_EMAIL!;
  const password = process.env.E2E_PASSWORD!;
  const locationId = process.env.E2E_LOCATION_ID!;
  const resourceId = process.env.E2E_RESOURCE_ID!;
  const serviceId = process.env.E2E_SERVICE_ID!;

  let accessToken = '';
  let tenantId = '';

  beforeAll(async () => {
    const r = await client.post(
      '/api/auth/login',
      { email, password },
      { headers: { 'X-Tenant-Slug': tenantSlug, 'x-e2e': '1' } },
    );

    accessToken = r.data.accessToken;
    expect(accessToken).toBeTruthy();

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) throw new Error('E2E fixtures missing (tenant)');
    tenantId = tenant.id;
  });

  beforeEach(async () => {
    await prisma.appointmentHistory.deleteMany({ where: { tenantId } });
    await prisma.appointment.deleteMany({ where: { tenantId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function getFirstSlot(q: any) {
    const r = await client.get('/api/availability', {
      params: q,
      headers: {
        'X-Tenant-Slug': tenantSlug,
        Authorization: `Bearer ${accessToken}`,
        'x-e2e': '1',
      },
    });

    const slot = r.data?.slots?.[0];
    if (!slot) throw new Error('No slots available in fixture');
    return slot as { startsAt: string; endsAt: string };
  }

  async function getAllSlots(q: any) {
    const r = await client.get('/api/availability', {
      params: q,
      headers: {
        'X-Tenant-Slug': tenantSlug,
        Authorization: `Bearer ${accessToken}`,
        'x-e2e': '1',
      },
    });
    return (r.data?.slots ?? []) as { startsAt: string; endsAt: string }[];
  }

  async function createAppointment(customerName: string) {
    const date = '2026-02-23';
    const slot1 = await getFirstSlot({ locationId, resourceId, serviceId, date });

    const created = await client.post(
      '/api/appointments',
      { locationId, resourceId, serviceId, startsAt: slot1.startsAt, endsAt: slot1.endsAt, customerName },
      { headers: { 'X-Tenant-Slug': tenantSlug, Authorization: `Bearer ${accessToken}`, 'x-e2e': '1' } },
    );

    const appointmentId = created.data.id as string;
    expect(appointmentId).toBeTruthy();
    return { appointmentId, slot1 };
  }

  async function rescheduleAppointment(appointmentId: string, oldStartsAt: string) {
    const date = '2026-02-23';
    const all = await getAllSlots({ locationId, resourceId, serviceId, date });
    const next = all.find((s) => s.startsAt !== oldStartsAt) ?? all[1];
    if (!next) throw new Error('No alternative slot to reschedule');

    await client.patch(
      `/api/appointments/${appointmentId}/reschedule`,
      { startsAt: next.startsAt, endsAt: next.endsAt, reason: 'e2e rs', idempotencyKey: `rs-${appointmentId}` },
      { headers: { 'X-Tenant-Slug': tenantSlug, Authorization: `Bearer ${accessToken}`, 'x-e2e': '1' } },
    );
  }

  async function cancelAppointment(appointmentId: string) {
    await client.patch(
      `/api/appointments/${appointmentId}/cancel`,
      { reason: 'e2e cancel', idempotencyKey: `c-${appointmentId}` },
      { headers: { 'X-Tenant-Slug': tenantSlug, Authorization: `Bearer ${accessToken}`, 'x-e2e': '1' } },
    );
  }

  it('GET /appointments/:id/history returns ASC ordered items and paginates with cursor (no duplicates)', async () => {
    const { appointmentId, slot1 } = await createAppointment('E2E HIST ASC');
    await rescheduleAppointment(appointmentId, slot1.startsAt);
    await cancelAppointment(appointmentId);

    // Page 1
    const r1 = await client.get(`/api/appointments/${appointmentId}/history`, {
      params: { limit: 1 },
      headers: { 'X-Tenant-Slug': tenantSlug, Authorization: `Bearer ${accessToken}`, 'x-e2e': '1' },
    });

    expect(r1.status).toBe(200);
    expect(r1.data.items).toHaveLength(1);
    expect(r1.data.items[0].action).toBeTruthy();
    expect(r1.data.nextCursor).toBeTruthy();

    const firstId = r1.data.items[0].id as string;
    const cursor1 = r1.data.nextCursor as string;

    // Page 2
    const r2 = await client.get(`/api/appointments/${appointmentId}/history`, {
      params: { limit: 1, cursor: cursor1 },
      headers: { 'X-Tenant-Slug': tenantSlug, Authorization: `Bearer ${accessToken}`, 'x-e2e': '1' },
    });

    const ids2 = (r2.data.items as any[]).map((x) => x.id);
    expect(ids2).not.toContain(firstId);

    // Order ASC check (whole list)
    const rAll = await client.get(`/api/appointments/${appointmentId}/history`, {
      params: { limit: 100 },
      headers: { 'X-Tenant-Slug': tenantSlug, Authorization: `Bearer ${accessToken}`, 'x-e2e': '1' },
    });

    const ats = (rAll.data.items as any[]).map((x) => new Date(x.at).getTime());
    expect([...ats].sort((a, b) => a - b)).toEqual(ats);
  });

  it('per-appointment cursor is scope-bound: cursor from appt A cannot be used for appt B (400)', async () => {
    const a = await createAppointment('E2E A');
    await rescheduleAppointment(a.appointmentId, a.slot1.startsAt);

    const b = await createAppointment('E2E B');
    await rescheduleAppointment(b.appointmentId, b.slot1.startsAt);

    const r1 = await client.get(`/api/appointments/${a.appointmentId}/history`, {
      params: { limit: 1 },
      headers: { 'X-Tenant-Slug': tenantSlug, Authorization: `Bearer ${accessToken}`, 'x-e2e': '1' },
    });

    const cursor = r1.data.nextCursor as string;
    expect(cursor).toBeTruthy();

    // use A cursor on B endpoint => 400 Invalid cursor
    await expect(
      client.get(`/api/appointments/${b.appointmentId}/history`, {
        params: { limit: 1, cursor },
        headers: { 'X-Tenant-Slug': tenantSlug, Authorization: `Bearer ${accessToken}`, 'x-e2e': '1' },
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('GET /appointments/history returns DESC ordered items and paginates with cursor (no duplicates)', async () => {
    const a = await createAppointment('E2E GLOBAL A');
    await rescheduleAppointment(a.appointmentId, a.slot1.startsAt);

    const b = await createAppointment('E2E GLOBAL B');
    await rescheduleAppointment(b.appointmentId, b.slot1.startsAt);
    await cancelAppointment(b.appointmentId);

    const commonParams = { limit: 2, direction: 'desc' as const };

    const r1 = await client.get(`/api/appointments/history`, {
      params: commonParams,
      headers: {
        'X-Tenant-Slug': tenantSlug,
        Authorization: `Bearer ${accessToken}`,
        'x-e2e': '1',
      },
    });

    expect(r1.status).toBe(200);
    expect(r1.data.items.length).toBeGreaterThanOrEqual(1);

    const ats1 = (r1.data.items as any[]).map((x) => new Date(x.at).getTime());
    expect([...ats1].sort((a, b) => b - a)).toEqual(ats1);

    const cursor1 = r1.data.nextCursor as string | undefined;
    if (cursor1) {
      const ids1 = (r1.data.items as any[]).map((x) => x.id);

      const r2 = await client.get(`/api/appointments/history`, {
        params: { ...commonParams, cursor: cursor1 },
        headers: {
          'X-Tenant-Slug': tenantSlug,
          Authorization: `Bearer ${accessToken}`,
          'x-e2e': '1',
        },
      });

      const ids2 = (r2.data.items as any[]).map((x) => x.id);
      for (const id of ids1) expect(ids2).not.toContain(id);
    }
  });

  it('cursor scope mismatch: per-appointment cursor cannot be used on global history (400)', async () => {
    const a = await createAppointment('E2E SCOPE MISMATCH');
    await rescheduleAppointment(a.appointmentId, a.slot1.startsAt);

    const r1 = await client.get(`/api/appointments/${a.appointmentId}/history`, {
      params: { limit: 1 },
      headers: { 'X-Tenant-Slug': tenantSlug, Authorization: `Bearer ${accessToken}`, 'x-e2e': '1' },
    });

    const cursor = r1.data.nextCursor as string;
    expect(cursor).toBeTruthy();

    await expect(
      client.get(`/api/appointments/history`, {
        params: { limit: 1, cursor },
        headers: { 'X-Tenant-Slug': tenantSlug, Authorization: `Bearer ${accessToken}`, 'x-e2e': '1' },
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('cursor with garbage is rejected (400)', async () => {
    const { appointmentId } = await createAppointment('E2E BAD CURSOR');

    await expect(
      client.get(`/api/appointments/${appointmentId}/history`, {
        params: { limit: 10, cursor: 'not-a-cursor' },
        headers: { 'X-Tenant-Slug': tenantSlug, Authorization: `Bearer ${accessToken}`, 'x-e2e': '1' },
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });
});