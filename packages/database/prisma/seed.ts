import { prisma } from '@epay/database';

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Create admin user for development
  const admin = await prisma.user.upsert({
    where: { email: 'admin@epay.dev' },
    update: {},
    create: {
      email: 'admin@epay.dev',
      displayName: 'EPay Admin',
      role: 'ADMIN',
    },
  });

  console.log('Created admin user:', admin.id);

  // Create test merchant
  const merchantUser = await prisma.user.upsert({
    where: { email: 'merchant@epay.dev' },
    update: {},
    create: {
      email: 'merchant@epay.dev',
      displayName: 'Demo Merchant',
      role: 'MERCHANT',
    },
  });

  const merchant = await prisma.merchant.upsert({
    where: { userId: merchantUser.id },
    update: {},
    create: {
      userId: merchantUser.id,
      businessName: 'Demo Store',
      businessEmail: 'merchant@epay.dev',
      status: 'ACTIVE',
      verificationLevel: 'VERIFIED',
      settlementAddress: 'EQD...demo_merchant_address',
    },
  });

  console.log('Created demo merchant:', merchant.id);

  console.log('Database seeding completed.');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
