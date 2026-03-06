import axios from 'axios';
import { getMetricsText, readCounter } from '../support/metrics-utils';

describe('Appointments (e2e)', () => {
  const baseURL = process.env.NX_BASE_URL ?? 'http://localhost:3000';
  const client = axios.create({ baseURL });

  const tenantSlug = process.env.E2E_TENANT_SLUG!;
  const email = process.env.E2E_EMAIL!;
  const password = process.env.E2E_PASSWORD!;
  const locationId = process.env.E2E_LOCATION_ID!;
  const resourceId = process.env.E2E_RESOURCE_ID!;
  const serviceId = process.env.E2E_SERVICE_ID!;

  let accessToken = '';

  beforeAll(async () => {
    const r = await client.post(
      '/api/auth/login',
      { email, password },
      { headers: { 'X-Tenant-Slug': tenantSlug, 'x-e2e': '1' } },
    );

    accessToken = r.data.accessToken;
    expect(accessToken).toBeTruthy();
  });

    async function getFirstSlot(client: any, tenantSlug: string, token: string, q: any) {
        const r = await client.get('/api/availability', {
            params: q,
            headers: {
            'X-Tenant-Slug': tenantSlug,
            Authorization: `Bearer ${token}`,
            'x-e2e': '1'
            },
        });

        const slot = r.data?.slots?.[0];
        if (!slot) throw new Error('No slots available in fixture');
        return slot as { startsAt: string; endsAt: string };
    }

    it('creates appointment inside availability (201)', async () => {
        const slot = await getFirstSlot(client, tenantSlug, accessToken, {
            locationId,
            resourceId,
            serviceId,
            date: '2026-02-23',
        });

        const body = {
            locationId,
            resourceId,
            serviceId,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            customerName: 'E2E OK',
        };

        const r = await client.post('/api/appointments', body, {
            headers: {
                'X-Tenant-Slug': tenantSlug,
                Authorization: `Bearer ${accessToken}`,
                'x-e2e': '1'
            },
        });

        expect([200, 201]).toContain(r.status);
        expect(r.data).toHaveProperty('id');
        expect(r.data.resourceId).toBe(resourceId);
        expect(r.data.serviceId).toBe(serviceId);
    });

    it('fails with OUTSIDE_AVAILABILITY when slot is busy (400)', async () => {
        // Busy ya seed: 10:00-10:30 local => 13:00Z-13:30Z
        const body = {
        locationId,
        resourceId,
        serviceId,
        startsAt: '2026-02-23T13:00:00.000Z',
        endsAt: '2026-02-23T13:30:00.000Z',
        customerName: 'E2E BUSY',
        };

        try {
            await client.post('/api/appointments', body, {
                headers: {
                    'X-Tenant-Slug': tenantSlug,
                    Authorization: `Bearer ${accessToken}`,
                    'x-e2e': '1'
                },
            });
            throw new Error('Expected 400');
        } catch (e: any) {
            expect(e.response.status).toBe(400);
            expect(JSON.stringify(e.response.data)).toContain('OUTSIDE_AVAILABILITY');
        }
    });

    it('overlap is enforced at DB level (one wins, one 409) and increments overlap metric', async () => {
        const slot = await getFirstSlot(client, tenantSlug, accessToken, {
            locationId, resourceId, serviceId, date: '2026-02-23',
        });

        const body = {
            locationId,
            resourceId,
            serviceId,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            customerName: 'E2E RACE',
        };

        const headers = {
            'X-Tenant-Slug': tenantSlug,
            Authorization: `Bearer ${accessToken}`,
            'x-e2e': '1',
        };

        // metrics BEFORE
        const beforeText = await getMetricsText(client, headers);
        const beforeOverlap = readCounter(beforeText, 'appointment_overlap_conflicts_total', {
            tenant: tenantSlug,
        });

        const results = await Promise.allSettled([
            client.post('/api/appointments', body, { headers }),
            client.post('/api/appointments', body, { headers }),
        ]);

        const ok = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
        const bad = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

        expect(ok).toHaveLength(1);
        expect([200, 201]).toContain(ok[0].value.status);

        expect(bad).toHaveLength(1);
        const status = bad[0].reason?.response?.status;

        // ideal: 409 por exclusion constraint
        // a veces puede salir 400 si una request llega tarde y cae en precheck
        expect([409, 400]).toContain(status);

        if (status === 409) {
            expect(JSON.stringify(bad[0].reason.response.data)).toContain('APPOINTMENT_OVERLAP');
        } else {
            expect(JSON.stringify(bad[0].reason.response.data)).toContain('OUTSIDE_AVAILABILITY');
        }

        // metrics AFTER
        const afterText = await getMetricsText(client, headers);
        const afterOverlap = readCounter(afterText, 'appointment_overlap_conflicts_total', {
            tenant: tenantSlug,
        });

        if (status === 409) {
            // ✅ solo se incrementa si realmente hubo 23P01 → 409
            expect(afterOverlap).toBe(beforeOverlap + 1);
        } else {
            // ✅ si fue precheck 400, no debería tocarse el counter
            expect(afterOverlap).toBe(beforeOverlap);
        }
        });
});