const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

function time(hhmm) {
  // genera un Date fijo donde solo importa la hora (para columnas TIME)
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

async function main() {
  // plan
  let plan = await prisma.plan.findFirst({ where: { name: 'starter' } });
  if (!plan) plan = await prisma.plan.create({ data: { name: 'starter', price: 0 } });

  // tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'innova' },
    update: { planId: plan.id, name: 'Innova' },
    create: { name: 'Innova', slug: 'innova', planId: plan.id },
  });

  // user owner
  const email = 'admin@innova.com';
  const passwordHash = await argon2.hash('Admin123!');
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, emailVerified: true },
  });

  // membership OWNER
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: { role: 'OWNER' },
    create: { userId: user.id, tenantId: tenant.id, role: 'OWNER' },
  });

  // -------------------------
  // ✅ Dataset mínimo operable
  // -------------------------

  // Location
  const location = await prisma.location.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: 'Innova - Central' }, // requiere @@unique([tenantId, name])
    },
    update: { timeZone: 'America/Argentina/San_Luis', isActive: true },
    create: {
      tenantId: tenant.id,
      name: 'Innova - Central',
      timeZone: 'America/Argentina/San_Luis',
      isActive: true,
    },
  });

  // Resource
  const resource = await prisma.resource.upsert({
    where: {
      tenantId_locationId_name: {
        tenantId: tenant.id,
        locationId: location.id,
        name: 'Consultorio 1',
      }, // requiere @@unique([tenantId, locationId, name])
    },
    update: { isActive: true },
    create: {
      tenantId: tenant.id,
      locationId: location.id,
      name: 'Consultorio 1',
      kind: 'ROOM',
      isActive: true,
    },
  });

  // Service
  const service = await prisma.service.upsert({
    where: {
      tenantId_locationId_name: {
        tenantId: tenant.id,
        locationId: location.id,
        name: 'Consulta general',
      }, // requiere @@unique([tenantId, locationId, name])
    },
    update: { isActive: true, durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 },
    create: {
      tenantId: tenant.id,
      locationId: location.id,
      name: 'Consulta general',
      description: 'Consulta estándar',
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      isActive: true,
    },
  });

  // Link Resource <-> Service (N:M)
  await prisma.resourceService.upsert({
    where: {
      tenantId_resourceId_serviceId: {
        tenantId: tenant.id,
        resourceId: resource.id,
        serviceId: service.id,
      },
    },
    update: {},
    create: { tenantId: tenant.id, resourceId: resource.id, serviceId: service.id },
  });

  // WeeklySchedule: Lun-Vie 09:00-17:00
  // dayOfWeek: 1..5 (si definís 0=Dom)
  for (const dayOfWeek of [1, 2, 3, 4, 5]) {
    await prisma.weeklySchedule.upsert({
      where: {
        tenantId_resourceId_dayOfWeek_startTime_endTime: {
          tenantId: tenant.id,
          resourceId: resource.id,
          dayOfWeek,
          startTime: time('09:00'),
          endTime: time('17:00'),
        },
      },
      update: {
        locationId: location.id,
        effectiveTo: null,
      },
      create: {
        tenantId: tenant.id,
        locationId: location.id,
        resourceId: resource.id,
        dayOfWeek,
        startTime: time('09:00'),
        endTime: time('17:00'),
      },
    });
  }

  // (Opcional) Override de prueba: bloquear hoy 13:00-14:00
  // Comentado para no sorprenderte; descomentá si querés testear overrides.
  /*
  const now = new Date();
  const startBlock = new Date(now);
  startBlock.setHours(13, 0, 0, 0);
  const endBlock = new Date(now);
  endBlock.setHours(14, 0, 0, 0);

  await prisma.availabilityOverride.create({
    data: {
      tenantId: tenant.id,
      locationId: location.id,
      resourceId: resource.id,
      kind: 'BLOCK',
      startsAt: startBlock,
      endsAt: endBlock,
      reason: 'Almuerzo',
    },
  });
  */

  // (Opcional) Appointment de prueba para verificar overlap (10:00-10:30)
  // Comentado para no crear turnos sin querer.
  /*
  const startAppt = new Date();
  startAppt.setHours(10, 0, 0, 0);
  const endAppt = new Date();
  endAppt.setHours(10, 30, 0, 0);

  await prisma.appointment.create({
    data: {
      tenantId: tenant.id,
      locationId: location.id,
      resourceId: resource.id,
      serviceId: service.id,
      status: 'BOOKED',
      startsAt: startAppt,
      endsAt: endAppt,
      customerName: 'Paciente Demo',
      createdByUserId: user.id,
    },
  });
  */
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());