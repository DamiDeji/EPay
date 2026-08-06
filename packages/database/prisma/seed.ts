import { prisma } from '@epay/database';

async function main(): Promise<void> {
  console.log('Seeding database for Stellar network...');

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
      businessName: 'Demo Stellar Store',
      businessEmail: 'merchant@epay.dev',
      status: 'ACTIVE',
      verificationLevel: 'VERIFIED',
      settlementPublicKey: 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234',
      supportedAssets: [{ code: 'XLM', issuer: 'native', type: 'native' }],
    },
  });

  console.log('Created demo merchant:', merchant.id);

  // Create test wallets for Stellar
  const testWallets = [
    {
      publicKey: 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234',
      provider: 'freighter',
      network: 'testnet',
    },
    {
      publicKey: 'GDEFGH1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234',
      provider: 'xbull',
      network: 'testnet',
    },
  ];

  for (const wallet of testWallets) {
    await prisma.wallet.upsert({
      where: { publicKey: wallet.publicKey },
      update: {},
      create: {
        publicKey: wallet.publicKey,
        provider: wallet.provider,
        network: wallet.network,
        isActive: true,
      },
    });
  }

  console.log('Created test wallets');
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
