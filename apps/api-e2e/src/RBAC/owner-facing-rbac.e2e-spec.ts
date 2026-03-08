import axios from 'axios';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const baseURL = process.env.NX_BASE_URL ?? 'http://localhost:3000';
const TENANT = process.env.E2E_TENANT_SLUG!;
const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;

async function login() {
	const res = await axios.post(
		`${baseURL}/api/auth/login`,
		{ email: EMAIL, password: PASSWORD },
		{ headers: { 'X-Tenant-Slug': TENANT, 'x-e2e': '1' } },
	);

	return res.data.accessToken as string;
}

describe('Owner-facing RBAC (e2e)', () => {
	let token: string;
	let tenantId: string;
	let userId: string;

	beforeAll(async () => {
		token = await login();

		const user = await prisma.user.findUnique({
			where: { email: EMAIL },
			select: { id: true },
		});

		if (!user) {
			throw new Error(`E2E user not found for email=${EMAIL}`);
		}

		userId = user.id;

		const membership = await prisma.membership.findFirst({
			where: {
				userId,
				tenant: {
					slug: TENANT,
				},
			},
			select: {
				tenantId: true,
				role: true,
			},
		});

		if (!membership) {
			throw new Error(`E2E membership not found for email=${EMAIL} tenant=${TENANT}`);
		}

		tenantId = membership.tenantId;
	});

	beforeEach(async () => {
		await prisma.membership.update({
			where: {
				userId_tenantId: {
					userId,
					tenantId,
				},
			},
			data: {
				role: Role.ADMIN,
			},
		});
	});

	afterAll(async () => {
		if (userId && tenantId) {
			await prisma.membership.update({
				where: {
					userId_tenantId: {
						userId,
						tenantId,
					},
				},
				data: {
					role: Role.ADMIN,
				},
			});
		}

		await prisma.$disconnect();
	});

	function authHeaders() {
		return {
			Authorization: `Bearer ${token}`,
			'X-Tenant-Slug': TENANT,
			'x-e2e': '1',
		};
	}

	async function createLocation(name: string) {
		return axios.post(
			`${baseURL}/api/locations`,
			{
				name,
				timeZone: 'America/Argentina/San_Luis',
			},
			{
				headers: authHeaders(),
			},
		);
	}

	it('allows STAFF to read locations', async () => {
		const created = await createLocation(`RBAC Read ${Date.now()}`);
		const id = created.data.id;

		await prisma.membership.update({
			where: {
				userId_tenantId: {
					userId,
					tenantId,
				},
			},
			data: {
				role: Role.STAFF,
			},
		});

		const list = await axios.get(`${baseURL}/api/locations?limit=10`, {
			headers: authHeaders(),
		});

		expect(list.status).toBe(200);
		expect(Array.isArray(list.data.items)).toBe(true);
		expect(list.data.items.some((x: any) => x.id === id)).toBe(true);

		const get = await axios.get(`${baseURL}/api/locations/${id}`, {
			headers: authHeaders(),
		});

		expect(get.status).toBe(200);
		expect(get.data.id).toBe(id);
	});

	it('forbids STAFF to create locations', async () => {
		await prisma.membership.update({
			where: {
				userId_tenantId: {
					userId,
					tenantId,
				},
			},
			data: {
				role: Role.STAFF,
			},
		});

		await expect(
			axios.post(
				`${baseURL}/api/locations`,
				{
					name: `RBAC Forbidden ${Date.now()}`,
					timeZone: 'America/Argentina/San_Luis',
				},
				{
					headers: authHeaders(),
				},
			),
		).rejects.toMatchObject({
			response: {
				status: 403,
				data: {
					code: 'INSUFFICIENT_ROLE',
				},
			},
		});
	});

	it('allows STAFF to read weekly schedules', async () => {
		await prisma.membership.update({
			where: {
				userId_tenantId: {
					userId,
					tenantId,
				},
			},
			data: {
				role: Role.STAFF,
			},
		});

		const list = await axios.get(`${baseURL}/api/weekly-schedules`, {
			headers: authHeaders(),
		});

		expect(list.status).toBe(200);
		expect(Array.isArray(list.data.items)).toBe(true);
	});

	it('allows STAFF to read availability overrides', async () => {
		await prisma.membership.update({
			where: {
				userId_tenantId: {
					userId,
					tenantId,
				},
			},
			data: {
				role: Role.STAFF,
			},
		});

		const list = await axios.get(
			`${baseURL}/api/availability-overrides?limit=10`,
			{
				headers: authHeaders(),
			},
		);

		expect(list.status).toBe(200);
		expect(Array.isArray(list.data.items)).toBe(true);
	});

	it('allows ADMIN to create config', async () => {
		const created = await createLocation(`RBAC Admin Create ${Date.now()}`);

		expect(created.status).toBe(201);
		expect(created.data.name).toContain('RBAC Admin Create');
	});

	it('uses membership from DB, not stale role from token', async () => {
		const createdBeforeDowngrade = await createLocation(
			`RBAC Before Downgrade ${Date.now()}`,
		);

		expect(createdBeforeDowngrade.status).toBe(201);

		await prisma.membership.update({
			where: {
				userId_tenantId: {
					userId,
					tenantId,
				},
			},
			data: {
				role: Role.STAFF,
			},
		});

		await expect(
			axios.post(
				`${baseURL}/api/locations`,
				{
					name: `RBAC After Downgrade ${Date.now()}`,
					timeZone: 'America/Argentina/San_Luis',
				},
				{
					headers: authHeaders(),
				},
			),
		).rejects.toMatchObject({
			response: {
				status: 403,
				data: {
					code: 'INSUFFICIENT_ROLE',
				},
			},
		});
	});
});