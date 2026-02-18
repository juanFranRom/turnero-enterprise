const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  let plan = await prisma.plan.findFirst({ where: { name: 'starter' } });
  if (!plan) {
    plan = await prisma.plan.create({
      data: { name: 'starter', price: 0 },
    });
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'innova' },
    update: { planId: plan.id, name: 'Innova' },
    create: { name: 'Innova', slug: 'innova', planId: plan.id },
  });

  console.log('Seed completed');
  console.log({ plan, tenant });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
