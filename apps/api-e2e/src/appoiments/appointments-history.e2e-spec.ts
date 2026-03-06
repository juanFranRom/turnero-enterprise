import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { getMetricsText, readCounter } from '../support/metrics-utils';

describe('AppointmentHistory (e2e)', () => {
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
  let userId = '';

  const authHeaders = () => ({
    'X-Tenant-Slug': tenantSlug,
    Authorization: `Bearer ${accessToken}`,
    'x-e2e': '1',
  });

  beforeEach(async () => {
    await prisma.appointmentHistory.deleteMany({ where: { tenantId } });
    await prisma.appointment.deleteMany({ where: { tenantId } });
  });

  beforeAll(async () => {
    const r = await client.post(
      '/api/auth/login',
      { email, password },
      { headers: { 'X-Tenant-Slug': tenantSlug, 'x-e2e': '1' } },
    );

    accessToken = r.data.accessToken;
    expect(accessToken).toBeTruthy();

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    if (!tenant || !user) throw new Error('E2E fixtures missing (tenant/user)');

    tenantId = tenant.id;
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function getFirstSlot(q: any) {
    const r = await client.get('/api/availability', {
      params: q,
      headers: authHeaders(),
    });

    const slot = r.data?.slots?.[0];
    if (!slot) throw new Error('No slots available in fixture');
    return slot as { startsAt: string; endsAt: string };
  }

  it('writes CREATED + RESCHEDULED + CANCELLED history (order, actor) + increments business metrics', async () => {
    // metrics BEFORE
    const beforeText = await getMetricsText(client, authHeaders());
    const beforeCreated = readCounter(beforeText, 'appointments_created_total', { tenant: tenantSlug });
    const beforeRescheduled = readCounter(beforeText, 'appointments_rescheduled_total', { tenant: tenantSlug });
    const beforeCancelled = readCounter(beforeText, 'appointments_cancelled_total', { tenant: tenantSlug });

    // 1) create
    const slot1 = await getFirstSlot({ locationId, resourceId, serviceId, date: '2026-02-23' });

    const createBody = {
      locationId,
      resourceId,
      serviceId,
      startsAt: slot1.startsAt,
      endsAt: slot1.endsAt,
      customerName: 'E2E HIST',
    };

    const created = await client.post('/api/appointments', createBody, {
      headers: authHeaders(),
    });

    const appointmentId = created.data.id as string;
    expect(appointmentId).toBeTruthy();

    // si te devuelve el mismo slot, avanzá uno
    const all = (await client.get('/api/availability', {
      params: { locationId, resourceId, serviceId, date: '2026-02-23' },
      headers: authHeaders(),
    })).data.slots as { startsAt: string; endsAt: string }[];

    const next = all.find(s => s.startsAt !== slot1.startsAt) ?? all[0];
    if (!next) throw new Error('No alternative slot to reschedule');

    // 2) reschedule
    await client.patch(
      `/api/appointments/${appointmentId}/reschedule`,
      {
        startsAt: next.startsAt,
        endsAt: next.endsAt,
        reason: 'e2e reschedule',
        idempotencyKey: 'rs-e2e-1',
      },
      { headers: authHeaders() },
    );

    // 3) cancel
    await client.patch(
      `/api/appointments/${appointmentId}/cancel`,
      {
        reason: 'e2e cancel',
        idempotencyKey: 'c-e2e-1',
      },
      { headers: authHeaders() },
    );

    // 4) assert DB
    const history = await prisma.appointmentHistory.findMany({
      where: { tenantId, appointmentId },
      orderBy: { createdAt: 'asc' },
      select: { action: true, actorType: true, actorUserId: true, prevStartsAt: true, newStartsAt: true },
    });

    expect(history.map(h => h.action)).toEqual(['CREATED', 'RESCHEDULED', 'CANCELLED']);

    for (const h of history) {
      expect(h.actorType).toBe('USER');
      expect(h.actorUserId).toBe(userId);
    }

    const rs = history.find(h => h.action === 'RESCHEDULED')!;
    expect(rs.prevStartsAt).toBeTruthy();
    expect(rs.newStartsAt).toBeTruthy();

    // ✅ metrics AFTER (delta checks)
    const afterText = await getMetricsText(client, authHeaders());
    const afterCreated = readCounter(afterText, 'appointments_created_total', { tenant: tenantSlug });
    const afterRescheduled = readCounter(afterText, 'appointments_rescheduled_total', { tenant: tenantSlug });
    const afterCancelled = readCounter(afterText, 'appointments_cancelled_total', { tenant: tenantSlug });

    expect(afterCreated).toBe(beforeCreated + 1);
    expect(afterRescheduled).toBe(beforeRescheduled + 1);
    expect(afterCancelled).toBe(beforeCancelled + 1);
  });

  it('idempotency does not duplicate history (cancel) and does not double-increment cancel metric', async () => {
    // metrics BEFORE
    const beforeText = await getMetricsText(client, authHeaders());
    const beforeCancelled = readCounter(beforeText, 'appointments_cancelled_total', { tenant: tenantSlug });

    const slot = await getFirstSlot({ locationId, resourceId, serviceId, date: '2026-02-23' });

    const created = await client.post(
      '/api/appointments',
      {
        locationId,
        resourceId,
        serviceId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        customerName: 'E2E IDEM',
      },
      { headers: authHeaders() },
    );

    const appointmentId = created.data.id as string;

    // first cancel
    await client.patch(
      `/api/appointments/${appointmentId}/cancel`,
      { reason: 'idem', idempotencyKey: 'c-e2e-idem' },
      { headers: authHeaders() },
    );

    const count1 = await prisma.appointmentHistory.count({
      where: { tenantId, appointmentId, action: 'CANCELLED' },
    });
    expect(count1).toBe(1);

    // same cancel again (idempotent)
    await client.patch(
      `/api/appointments/${appointmentId}/cancel`,
      { reason: 'idem', idempotencyKey: 'c-e2e-idem' },
      { headers: authHeaders() },
    );

    const count2 = await prisma.appointmentHistory.count({
      where: { tenantId, appointmentId, action: 'CANCELLED' },
    });
    expect(count2).toBe(1);

    // ✅ metrics AFTER: cancel should have incremented only once
    const afterText = await getMetricsText(client, authHeaders());
    const afterCancelled = readCounter(afterText, 'appointments_cancelled_total', { tenant: tenantSlug });

    expect(afterCancelled).toBe(beforeCancelled + 1);
  });
});