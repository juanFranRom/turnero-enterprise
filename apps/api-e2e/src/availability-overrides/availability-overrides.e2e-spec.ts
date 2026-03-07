import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

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

async function createSameTenantLocation(token: string) {
    const res = await axios.post(
        `${baseURL}/api/locations`,
        {
            name: `AO Location ${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            timeZone: 'America/Argentina/San_Luis',
        },
        { headers: headers(token) },
    );

    return res.data.id as string;
}

async function createResource(
    token: string,
    args: { locationId: string; name?: string },
) {
    const res = await axios.post(
        `${baseURL}/api/resources`,
        {
            locationId: args.locationId,
            name:
                args.name ??
                `AO Resource ${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            kind: 'STAFF',
        },
        { headers: headers(token) },
    );

    return res.data.id as string;
}

describe('AvailabilityOverrides CRUD (e2e)', () => {
    let token: string;

    beforeAll(async () => {
        token = await login();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('creates + lists + gets + updates + deletes', async () => {
        const created = await axios.post(
            `${baseURL}/api/availability-overrides`,
            {
                locationId: LOCATION_ID,
                resourceId: RESOURCE_ID,
                kind: 'BLOCK',
                startsAt: '2026-04-10T14:00:00.000Z',
                endsAt: '2026-04-10T16:00:00.000Z',
                reason: 'Owner blocked slot',
            },
            { headers: headers(token) },
        );

        const id = created.data.id;
        expect(created.data.locationId).toBe(LOCATION_ID);
        expect(created.data.resourceId).toBe(RESOURCE_ID);
        expect(created.data.kind).toBe('BLOCK');
        expect(created.data.reason).toBe('Owner blocked slot');

        const list = await axios.get(
            `${baseURL}/api/availability-overrides?resourceId=${encodeURIComponent(RESOURCE_ID)}`,
            { headers: headers(token) },
        );

        expect(Array.isArray(list.data.items)).toBe(true);
        expect(list.data.items.some((x: any) => x.id === id)).toBe(true);

        const got = await axios.get(
            `${baseURL}/api/availability-overrides/${id}`,
            { headers: headers(token) },
        );

        expect(got.data.id).toBe(id);

        const updated = await axios.patch(
            `${baseURL}/api/availability-overrides/${id}`,
            {
                kind: 'EXTRA',
                startsAt: '2026-04-10T15:00:00.000Z',
                endsAt: '2026-04-10T17:00:00.000Z',
                reason: 'Extended availability',
            },
            { headers: headers(token) },
        );

        expect(updated.data.kind).toBe('EXTRA');
        expect(new Date(updated.data.startsAt).toISOString()).toBe(
            '2026-04-10T15:00:00.000Z',
        );
        expect(new Date(updated.data.endsAt).toISOString()).toBe(
            '2026-04-10T17:00:00.000Z',
        );
        expect(updated.data.reason).toBe('Extended availability');

        const del = await axios.delete(
            `${baseURL}/api/availability-overrides/${id}`,
            { headers: headers(token) },
        );

        expect(del.data.success).toBe(true);

        await expect(
            axios.get(`${baseURL}/api/availability-overrides/${id}`, {
                headers: headers(token),
            }),
        ).rejects.toMatchObject({
            response: { status: 404, data: { code: 'AVAILABILITY_OVERRIDE_NOT_FOUND' } },
        });
    });

    it('rejects invalid interval (400 INVALID_INTERVAL)', async () => {
        await expect(
            axios.post(
                `${baseURL}/api/availability-overrides`,
                {
                locationId: LOCATION_ID,
                resourceId: RESOURCE_ID,
                kind: 'BLOCK',
                startsAt: '2026-04-11T16:00:00.000Z',
                endsAt: '2026-04-11T15:00:00.000Z',
                },
                { headers: headers(token) },
            ),
        ).rejects.toMatchObject({
            response: { status: 400, data: { code: 'INVALID_INTERVAL' } },
        });
    });

    it('validates locationId belongs to tenant (404 LOCATION_NOT_FOUND)', async () => {
        await expect(
            axios.post(
                `${baseURL}/api/availability-overrides`,
                {
                locationId: OTHER_LOCATION_ID,
                resourceId: RESOURCE_ID,
                kind: 'BLOCK',
                startsAt: '2026-04-12T14:00:00.000Z',
                endsAt: '2026-04-12T16:00:00.000Z',
                },
                { headers: headers(token) },
            ),
        ).rejects.toMatchObject({
            response: { status: 404, data: { code: 'LOCATION_NOT_FOUND' } },
        });
    });

    it('validates resourceId belongs to tenant (404 RESOURCE_NOT_FOUND)', async () => {
        await expect(
            axios.post(
                `${baseURL}/api/availability-overrides`,
                {
                locationId: LOCATION_ID,
                resourceId: randomUUID(),
                kind: 'BLOCK',
                startsAt: '2026-04-13T14:00:00.000Z',
                endsAt: '2026-04-13T16:00:00.000Z',
                },
                { headers: headers(token) },
            ),
        ).rejects.toMatchObject({
            response: { status: 404, data: { code: 'RESOURCE_NOT_FOUND' } },
        });
    });

    it('rejects resource-location mismatch (400 INVALID_LOCATION_RESOURCE_RELATION)', async () => {
        const sameTenantLocationId = await createSameTenantLocation(token);

        await expect(
            axios.post(
                `${baseURL}/api/availability-overrides`,
                {
                    locationId: sameTenantLocationId,
                    resourceId: RESOURCE_ID,
                    kind: 'BLOCK',
                    startsAt: '2026-04-14T14:00:00.000Z',
                    endsAt: '2026-04-14T16:00:00.000Z',
                },
                { headers: headers(token) },
            ),
        ).rejects.toMatchObject({
            response: {
                status: 400,
                data: { code: 'INVALID_LOCATION_RESOURCE_RELATION' },
            },
        });
    });

    it('rejects overlap on same resource (409 AVAILABILITY_OVERRIDE_OVERLAP)', async () => {
        const first = await axios.post(
            `${baseURL}/api/availability-overrides`,
            {
                locationId: LOCATION_ID,
                resourceId: RESOURCE_ID,
                kind: 'BLOCK',
                startsAt: '2026-04-15T10:00:00.000Z',
                endsAt: '2026-04-15T12:00:00.000Z',
            },
            { headers: headers(token) },
        );

        await expect(
            axios.post(
                `${baseURL}/api/availability-overrides`,
                {
                    locationId: LOCATION_ID,
                    resourceId: RESOURCE_ID,
                    kind: 'EXTRA',
                    startsAt: '2026-04-15T11:00:00.000Z',
                    endsAt: '2026-04-15T13:00:00.000Z',
                },
                { headers: headers(token) },
            ),
        ).rejects.toMatchObject({
            response: {
                status: 409,
                data: { code: 'AVAILABILITY_OVERRIDE_OVERLAP' },
            },
        });

        await axios.delete(
        `${baseURL}/api/availability-overrides/${first.data.id}`,
        { headers: headers(token) },
        );
    });

    it('allows same interval on another resource of same tenant', async () => {
        const secondResourceId = await createResource(token, {
            locationId: LOCATION_ID,
            name: `AO Second Resource ${Date.now()}`,
        });

        const first = await axios.post(
            `${baseURL}/api/availability-overrides`,
            {
                locationId: LOCATION_ID,
                resourceId: RESOURCE_ID,
                kind: 'BLOCK',
                startsAt: '2026-04-16T10:00:00.000Z',
                endsAt: '2026-04-16T12:00:00.000Z',
            },
            { headers: headers(token) },
        );

        const second = await axios.post(
            `${baseURL}/api/availability-overrides`,
            {
                locationId: LOCATION_ID,
                resourceId: secondResourceId,
                kind: 'BLOCK',
                startsAt: '2026-04-16T10:00:00.000Z',
                endsAt: '2026-04-16T12:00:00.000Z',
            },
            { headers: headers(token) },
        );

        expect(second.data.resourceId).toBe(secondResourceId);

        await axios.delete(
            `${baseURL}/api/availability-overrides/${first.data.id}`,
            { headers: headers(token) },
        );
        await axios.delete(
            `${baseURL}/api/availability-overrides/${second.data.id}`,
            { headers: headers(token) },
        );
    });

    it('rejects update if it causes overlap (409 AVAILABILITY_OVERRIDE_OVERLAP)', async () => {
        const first = await axios.post(
            `${baseURL}/api/availability-overrides`,
            {
                locationId: LOCATION_ID,
                resourceId: RESOURCE_ID,
                kind: 'BLOCK',
                startsAt: '2026-04-17T08:00:00.000Z',
                endsAt: '2026-04-17T10:00:00.000Z',
            },
            { headers: headers(token) },
        );

        const second = await axios.post(
            `${baseURL}/api/availability-overrides`,
            {
                locationId: LOCATION_ID,
                resourceId: RESOURCE_ID,
                kind: 'BLOCK',
                startsAt: '2026-04-17T10:00:00.000Z',
                endsAt: '2026-04-17T12:00:00.000Z',
            },
            { headers: headers(token) },
        );

        await expect(
            axios.patch(
                `${baseURL}/api/availability-overrides/${second.data.id}`,
                {
                startsAt: '2026-04-17T09:30:00.000Z',
                endsAt: '2026-04-17T11:00:00.000Z',
                },
                { headers: headers(token) },
            ),
        ).rejects.toMatchObject({
            response: {
                status: 409,
                data: { code: 'AVAILABILITY_OVERRIDE_OVERLAP' },
            },
        });

        await axios.delete(
            `${baseURL}/api/availability-overrides/${first.data.id}`,
            { headers: headers(token) },
        );
        await axios.delete(
            `${baseURL}/api/availability-overrides/${second.data.id}`,
            { headers: headers(token) },
        );
    });

    it('tenant isolation: cannot read override from another tenant (401 Invalid tenant)', async () => {
        const created = await axios.post(
            `${baseURL}/api/availability-overrides`,
            {
                locationId: LOCATION_ID,
                resourceId: RESOURCE_ID,
                kind: 'BLOCK',
                startsAt: '2026-04-18T14:00:00.000Z',
                endsAt: '2026-04-18T16:00:00.000Z',
            },
            { headers: headers(token) },
        );

        const id = created.data.id;

        await expect(
            axios.get(`${baseURL}/api/availability-overrides/${id}`, {
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

        await axios.delete(`${baseURL}/api/availability-overrides/${id}`, {
            headers: headers(token),
        });
    });

    it('supports cursor pagination list', async () => {
        const a = await axios.post(
            `${baseURL}/api/availability-overrides`,
            {
                locationId: LOCATION_ID,
                resourceId: RESOURCE_ID,
                kind: 'BLOCK',
                startsAt: '2026-04-19T08:00:00.000Z',
                endsAt: '2026-04-19T09:00:00.000Z',
                reason: 'A',
            },
            { headers: headers(token) },
        );

        const b = await axios.post(
            `${baseURL}/api/availability-overrides`,
            {
                locationId: LOCATION_ID,
                resourceId: RESOURCE_ID,
                kind: 'BLOCK',
                startsAt: '2026-04-19T09:00:00.000Z',
                endsAt: '2026-04-19T10:00:00.000Z',
                reason: 'B',
            },
            { headers: headers(token) },
        );

        const firstPage = await axios.get(
            `${baseURL}/api/availability-overrides?resourceId=${encodeURIComponent(RESOURCE_ID)}&limit=1&direction=desc`,
            { headers: headers(token) },
        );

        expect(Array.isArray(firstPage.data.items)).toBe(true);
        expect(firstPage.data.items.length).toBe(1);
        expect(firstPage.data.nextCursor === null || typeof firstPage.data.nextCursor === 'string').toBe(true);

        if (firstPage.data.nextCursor) {
            const secondPage = await axios.get(
                `${baseURL}/api/availability-overrides?resourceId=${encodeURIComponent(RESOURCE_ID)}&limit=1&direction=desc&cursor=${encodeURIComponent(firstPage.data.nextCursor)}`,
                { headers: headers(token) },
            );

            expect(Array.isArray(secondPage.data.items)).toBe(true);
            expect(secondPage.data.items.length).toBe(1);
            expect(secondPage.data.items[0].id).not.toBe(firstPage.data.items[0].id);
        }

        await axios.delete(`${baseURL}/api/availability-overrides/${a.data.id}`, {
            headers: headers(token),
        });
        await axios.delete(`${baseURL}/api/availability-overrides/${b.data.id}`, {
            headers: headers(token),
        });
    });
});