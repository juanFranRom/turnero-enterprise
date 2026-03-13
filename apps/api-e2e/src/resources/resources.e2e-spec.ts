import axios from 'axios';
import { PrismaClient, ResourceKind, Role } from '@prisma/client';

const prisma = new PrismaClient();

const baseURL = process.env.NX_BASE_URL ?? 'http://localhost:3000';
const TENANT = process.env.E2E_TENANT_SLUG!;
const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;
const LOCATION_ID = process.env.E2E_LOCATION_ID!;
const OTHER_TENANT = process.env.E2E_OTHER_TENANT_SLUG!;
const OTHER_LOCATION_ID = process.env.E2E_OTHER_LOCATION_ID!;

async function login(email = EMAIL, password = PASSWORD) {
	const res = await axios.post(
		`${baseURL}/api/auth/login`,
		{ email, password },
		{ headers: { 'X-Tenant-Slug': TENANT, 'x-e2e': '1' } },
	);

	return res.data as {
		accessToken: string;
		user: {
			id: string;
			email: string;
			mustChangePassword?: boolean;
		};
		memberships: Array<{
			tenantId: string;
			tenantSlug: string;
			tenantName: string;
			role: string;
		}>;
		activeTenantSlug: string | null;
	};
}

function headers(token: string, tenantSlug = TENANT) {
	return {
		Authorization: `Bearer ${token}`,
		'X-Tenant-Slug': tenantSlug,
		'x-e2e': '1',
	};
}

describe('Resources CRUD (e2e)', () => {
	let token: string;

	beforeAll(async () => {
		const auth = await login();
		token = auth.accessToken;
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it('creates + lists + gets + updates + soft deletes a ROOM resource', async () => {
		const name = `Room ${Date.now()}`;

		const created = await axios.post(
			`${baseURL}/api/resources`,
			{
				locationId: LOCATION_ID,
				name,
				description: 'Main room',
				kind: ResourceKind.ROOM,
			},
			{ headers: headers(token) },
		);

		const id = created.data.resource.id;

		expect(created.data.resource.name).toBe(name);
		expect(created.data.resource.description).toBe('Main room');
		expect(created.data.resource.kind).toBe(ResourceKind.ROOM);
		expect(created.data.resource.isActive).toBe(true);
		expect(created.data.resource.locationId).toBe(LOCATION_ID);
		expect(created.data.person).toBeNull();
		expect(created.data.user).toBeNull();

		const list = await axios.get(
			`${baseURL}/api/resources?locationId=${encodeURIComponent(LOCATION_ID)}&kind=${ResourceKind.ROOM}`,
			{ headers: headers(token) },
		);

		expect(Array.isArray(list.data.items)).toBe(true);
		expect(list.data.items.some((r: any) => r.id === id)).toBe(true);

		const got = await axios.get(`${baseURL}/api/resources/${id}`, {
			headers: headers(token),
		});

		expect(got.data.id).toBe(id);
		expect(got.data.kind).toBe(ResourceKind.ROOM);
		expect(got.data.person).toBeNull();

		const upd = await axios.patch(
			`${baseURL}/api/resources/${id}`,
			{
				name: `${name} Updated`,
				description: 'Updated room description',
			},
			{ headers: headers(token) },
		);

		expect(upd.data.name).toBe(`${name} Updated`);
		expect(upd.data.description).toBe('Updated room description');
		expect(upd.data.kind).toBe(ResourceKind.ROOM);

		const del = await axios.delete(`${baseURL}/api/resources/${id}`, {
			headers: headers(token),
		});

		expect(del.data.success).toBe(true);

		const actives = await axios.get(`${baseURL}/api/resources?isActive=true`, {
			headers: headers(token),
		});

		expect(actives.data.items.some((r: any) => r.id === id)).toBe(false);

		const inactives = await axios.get(`${baseURL}/api/resources?isActive=false`, {
			headers: headers(token),
		});

		expect(inactives.data.items.some((r: any) => r.id === id)).toBe(true);
	});

	it('creates a PERSON resource without user and later generates user', async () => {
		const unique = Date.now();
		const personEmail = `resource-person-${unique}@example.com`;

		const created = await axios.post(
			`${baseURL}/api/resources`,
			{
				locationId: LOCATION_ID,
				name: `Person ${unique}`,
				description: 'Professional resource',
				kind: ResourceKind.PERSON,
				person: {
					firstName: 'Juan',
					lastName: 'Tester',
					documentNumber: `${unique}`,
					email: personEmail,
					phone: '2664000000',
				},
				user: {
					create: false,
				},
			},
			{ headers: headers(token) },
		);

		const id = created.data.resource.id;

		expect(created.data.resource.kind).toBe(ResourceKind.PERSON);
		expect(created.data.resource.personId).toBeTruthy();
		expect(created.data.person.email).toBe(personEmail);
		expect(created.data.person.user).toBeNull();
		expect(created.data.user).toBeNull();

		const generated = await axios.post(
			`${baseURL}/api/resources/${id}/generate-user`,
			{
				role: Role.STAFF,
			},
			{ headers: headers(token) },
		);

		expect(generated.data.user.email).toBe(personEmail);
		expect(generated.data.user.role).toBe(Role.STAFF);
		expect(generated.data.user.mustChangePassword).toBe(true);
		expect(typeof generated.data.user.temporaryPassword).toBe('string');
		expect(generated.data.user.temporaryPassword.length).toBeGreaterThanOrEqual(8);

		const got = await axios.get(`${baseURL}/api/resources/${id}`, {
			headers: headers(token),
		});

		expect(got.data.person).toBeTruthy();
		expect(got.data.person.user).toBeTruthy();
		expect(got.data.person.user.email).toBe(personEmail);
		expect(got.data.person.user.mustChangePassword).toBe(true);
	});

	it('creates a PERSON resource with user, requires initial password change, and syncs person/user email on update', async () => {
		const unique = Date.now();
		const initialEmail = `person-with-user-${unique}@example.com`;
		const updatedEmail = `person-with-user-updated-${unique}@example.com`;
		const temporaryPassword = `TmpPass-${unique}`;

		const created = await axios.post(
			`${baseURL}/api/resources`,
			{
				locationId: LOCATION_ID,
				name: `Doctor ${unique}`,
				description: 'Agenda enabled professional',
				kind: ResourceKind.PERSON,
				person: {
					firstName: 'Ana',
					lastName: 'Medica',
					documentNumber: `${unique + 1}`,
					email: initialEmail,
					phone: '2664111111',
				},
				user: {
					create: true,
					role: Role.STAFF,
					temporaryPassword,
				},
			},
			{ headers: headers(token) },
		);

		const id = created.data.resource.id;

		expect(created.data.user.email).toBe(initialEmail);
		expect(created.data.user.mustChangePassword).toBe(true);
		expect(created.data.user.temporaryPassword).toBe(temporaryPassword);

		const firstLogin = await login(initialEmail, temporaryPassword);

		expect(firstLogin.user.email).toBe(initialEmail);
		expect(firstLogin.user.mustChangePassword).toBe(true);

		await axios.post(
			`${baseURL}/api/auth/change-initial-password`,
			{
				currentPassword: temporaryPassword,
				newPassword: `NewPass-${unique}-OK`,
			},
			{
				headers: headers(firstLogin.accessToken),
			},
		);

		const meAfterPasswordChange = await axios.get(`${baseURL}/api/auth/me`, {
			headers: headers(firstLogin.accessToken),
		});

		expect(meAfterPasswordChange.data.user.mustChangePassword).toBe(false);

		const upd = await axios.patch(
			`${baseURL}/api/resources/${id}`,
			{
				description: 'Updated professional',
				person: {
					email: updatedEmail,
					phone: '2664222222',
				},
			},
			{ headers: headers(token) },
		);

		expect(upd.data.description).toBe('Updated professional');
		expect(upd.data.person.email).toBe(updatedEmail);
		expect(upd.data.person.phone).toBe('2664222222');
		expect(upd.data.person.user.email).toBe(updatedEmail);

		const relogin = await login(updatedEmail, `NewPass-${unique}-OK`);
		expect(relogin.user.email).toBe(updatedEmail);
		expect(relogin.user.mustChangePassword).toBe(false);
	});

	it('rejects generate-user for non PERSON resources', async () => {
		const created = await axios.post(
			`${baseURL}/api/resources`,
			{
				locationId: LOCATION_ID,
				name: `Equipment ${Date.now()}`,
				kind: ResourceKind.EQUIPMENT,
			},
			{ headers: headers(token) },
		);

		await expect(
			axios.post(
				`${baseURL}/api/resources/${created.data.resource.id}/generate-user`,
				{},
				{ headers: headers(token) },
			),
		).rejects.toMatchObject({
			response: {
				status: 409,
				data: {
					code: 'RESOURCE_GENERATE_USER_ONLY_FOR_PERSON',
				},
			},
		});
	});

	it('validates locationId belongs to tenant (404 LOCATION_NOT_FOUND)', async () => {
		await expect(
			axios.post(
				`${baseURL}/api/resources`,
				{
					locationId: OTHER_LOCATION_ID,
					name: `Wrong Location ${Date.now()}`,
					kind: ResourceKind.ROOM,
				},
				{ headers: headers(token) },
			),
		).rejects.toMatchObject({
			response: { status: 404, data: { code: 'LOCATION_NOT_FOUND' } },
		});
	});

	it('tenant isolation: cannot read resource from another tenant (401 INVALID_TENANT)', async () => {
		const created = await axios.post(
			`${baseURL}/api/resources`,
			{
				locationId: LOCATION_ID,
				name: `Isolation ${Date.now()}`,
				kind: ResourceKind.ROOM,
			},
			{ headers: headers(token) },
		);

		const id = created.data.resource.id;

		await expect(
			axios.get(`${baseURL}/api/resources/${id}`, {
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
	});

	it('enforces unique name per (tenantId, locationId, name) (409 RESOURCE_NAME_TAKEN)', async () => {
		const name = `Dup ${Date.now()}`;

		const r1 = await axios.post(
			`${baseURL}/api/resources`,
			{
				locationId: LOCATION_ID,
				name,
				kind: ResourceKind.ROOM,
			},
			{ headers: headers(token) },
		);

		await expect(
			axios.post(
				`${baseURL}/api/resources`,
				{
					locationId: LOCATION_ID,
					name,
					kind: ResourceKind.ROOM,
				},
				{ headers: headers(token) },
			),
		).rejects.toMatchObject({
			response: { status: 409, data: { code: 'RESOURCE_NAME_TAKEN' } },
		});

		await axios.delete(`${baseURL}/api/resources/${r1.data.resource.id}`, {
			headers: headers(token),
		});
	});

	it('rejects person payload for non PERSON resources', async () => {
		await expect(
			axios.post(
				`${baseURL}/api/resources`,
				{
					locationId: LOCATION_ID,
					name: `Invalid Person Payload ${Date.now()}`,
					kind: ResourceKind.ROOM,
					person: {
						firstName: 'Bad',
						lastName: 'Payload',
						documentNumber: `${Date.now()}`,
						email: `invalid-${Date.now()}@example.com`,
					},
				},
				{ headers: headers(token) },
			),
		).rejects.toMatchObject({
			response: {
				status: 409,
				data: {
					code: 'RESOURCE_PERSON_PAYLOAD_NOT_ALLOWED',
				},
			},
		});
	});

	it('requires person payload for PERSON resources', async () => {
		await expect(
			axios.post(
				`${baseURL}/api/resources`,
				{
					locationId: LOCATION_ID,
					name: `Missing Person ${Date.now()}`,
					kind: ResourceKind.PERSON,
				},
				{ headers: headers(token) },
			),
		).rejects.toMatchObject({
			response: {
				status: 409,
				data: {
					code: 'PERSON_RESOURCE_PERSON_REQUIRED',
				},
			},
		});
	});
});