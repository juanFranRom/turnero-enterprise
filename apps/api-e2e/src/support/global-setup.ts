import { waitForPortOpen } from '@nx/node/utils';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

/* eslint-disable */
module.exports = async function () {
  console.log('\nSetting up...\n');
  process.env.E2E = '1';

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  process.env.NX_BASE_URL = process.env.NX_BASE_URL ?? `http://${host}:${port}`;

  // 1) Puerto abierto
  await waitForPortOpen(port, { host });

  // 2) App lista (HTTP ready)
  const baseURL = process.env.NX_BASE_URL ?? `http://${host}:${port}`;
  const readyPath = process.env.E2E_READY_PATH ?? '/api/health'; // o '/api'
  const url = `${baseURL}${readyPath}`;

  const client = axios.create({ timeout: 1500 });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await client.get(url);
      if (r.status >= 200 && r.status < 300) break;
    } catch {}
    await new Promise((res) => setTimeout(res, 250));
    if (i === 59) throw new Error(`API not ready at ${url}`);
  }

  // 3) Seed determinística
  const prisma = new PrismaClient();

  const tenantSlug = 'e2e';
  const email = 'e2e@turnero.dev';
  const password = 'e2e-password-123';

  const existingTenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (existingTenant) {
    await prisma.appointmentHistory.deleteMany({ where: { tenantId: existingTenant.id } });
    await prisma.appointment.deleteMany({ where: { tenantId: existingTenant.id } });
    await prisma.availabilityOverride.deleteMany({ where: { tenantId: existingTenant.id } });
    await prisma.weeklySchedule.deleteMany({ where: { tenantId: existingTenant.id } });
    await prisma.resourceService.deleteMany({ where: { tenantId: existingTenant.id } });
    await prisma.service.deleteMany({ where: { tenantId: existingTenant.id } });
    await prisma.resource.deleteMany({ where: { tenantId: existingTenant.id } });
    await prisma.location.deleteMany({ where: { tenantId: existingTenant.id } });
    await prisma.membership.deleteMany({ where: { tenantId: existingTenant.id } });
    await prisma.session.deleteMany({ where: { tenantId: existingTenant.id } });
    await prisma.tenant.delete({ where: { id: existingTenant.id } });
  }

  const otherTenantSlug = 'e2e-other';

  const existingOther = await prisma.tenant.findUnique({ where: { slug: otherTenantSlug } });
  if (existingOther) {
    await prisma.appointmentHistory.deleteMany({ where: { tenantId: existingOther.id } });
    await prisma.appointment.deleteMany({ where: { tenantId: existingOther.id } });
    await prisma.availabilityOverride.deleteMany({ where: { tenantId: existingOther.id } });
    await prisma.weeklySchedule.deleteMany({ where: { tenantId: existingOther.id } });
    await prisma.resourceService.deleteMany({ where: { tenantId: existingOther.id } });
    await prisma.service.deleteMany({ where: { tenantId: existingOther.id } });
    await prisma.resource.deleteMany({ where: { tenantId: existingOther.id } });
    await prisma.location.deleteMany({ where: { tenantId: existingOther.id } });
    await prisma.membership.deleteMany({ where: { tenantId: existingOther.id } });
    await prisma.session.deleteMany({ where: { tenantId: existingOther.id } });
    await prisma.tenant.delete({ where: { id: existingOther.id } });
  }

  let plan = await prisma.plan.findFirst();
  if (!plan) {
    plan = await prisma.plan.create({ data: { name: 'E2E', price: 0 } });
  }

  const tenant = await prisma.tenant.create({
    data: { name: 'E2E Tenant', slug: tenantSlug, planId: plan.id },
  });

  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, isActive: true, emailVerified: true },
    create: { email, passwordHash, isActive: true, emailVerified: true },
  });

  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: { role: 'OWNER' },
    create: { userId: user.id, tenantId: tenant.id, role: 'OWNER' },
  });

  const location = await prisma.location.create({
    data: {
      tenantId: tenant.id,
      name: 'E2E Location',
      timeZone: 'America/Argentina/San_Luis',
      isActive: true,
    },
  });

  const resource = await prisma.resource.create({
    data: {
      tenantId: tenant.id,
      locationId: location.id,
      name: 'E2E Resource',
      kind: 'STAFF',
      isActive: true,
    },
  });

  const service = await prisma.service.create({
    data: {
      tenantId: tenant.id,
      locationId: location.id,
      name: 'E2E Service 30m',
      durationMinutes: 30,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 5,
      isActive: true,
    },
  });

  await prisma.resourceService.create({
    data: { tenantId: tenant.id, resourceId: resource.id, serviceId: service.id },
  });

  // Weekly: lunes=1, 09:00-12:00 local
  await prisma.weeklySchedule.create({
    data: {
      tenantId: tenant.id,
      locationId: location.id,
      resourceId: resource.id,
      dayOfWeek: 1,
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T12:00:00.000Z'),
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
    },
  });

  // Busy: 2026-02-23 10:00-10:30 local => 13:00Z-13:30Z
  await prisma.appointment.create({
    data: {
      tenantId: tenant.id,
      locationId: location.id,
      resourceId: resource.id,
      serviceId: service.id,
      status: 'BOOKED',
      startsAt: new Date('2026-02-23T13:00:00.000Z'),
      endsAt: new Date('2026-02-23T13:30:00.000Z'),
      customerName: 'Busy',
    },
  });

  const otherTenant = await prisma.tenant.create({
    data: { name: 'E2E Other Tenant', slug: otherTenantSlug, planId: plan.id },
  });

  const otherEmail = 'e2e-other@turnero.dev';
  const otherPassword = 'e2e-other-password-123';
  const otherPasswordHash = await argon2.hash(otherPassword);

  const otherUser = await prisma.user.upsert({
    where: { email: otherEmail },
    update: { passwordHash: otherPasswordHash, isActive: true, emailVerified: true },
    create: { email: otherEmail, passwordHash: otherPasswordHash, isActive: true, emailVerified: true },
  });

  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: otherUser.id, tenantId: otherTenant.id } },
    update: { role: 'OWNER' },
    create: { userId: otherUser.id, tenantId: otherTenant.id, role: 'OWNER' },
  });

  const otherLocation = await prisma.location.create({
    data: {
      tenantId: otherTenant.id,
      name: 'E2E Other Location',
      timeZone: 'UTC',
      isActive: true,
    },
  });

  await prisma.$disconnect();

  // 4) Exponer fixtures a los specs
  process.env.E2E_TENANT_SLUG = tenantSlug;
  process.env.E2E_EMAIL = email;
  process.env.E2E_PASSWORD = password;
  process.env.E2E_LOCATION_ID = location.id;
  process.env.E2E_RESOURCE_ID = resource.id;
  process.env.E2E_SERVICE_ID = service.id;
  process.env.E2E_OTHER_TENANT_SLUG = otherTenantSlug;
  process.env.E2E_OTHER_EMAIL = otherEmail;
  process.env.E2E_OTHER_PASSWORD = otherPassword;
  process.env.E2E_OTHER_LOCATION_ID = otherLocation.id;

  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
};