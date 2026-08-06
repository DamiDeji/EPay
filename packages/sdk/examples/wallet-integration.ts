/**
 * EPay SDK — Stellar Wallet Integration Example
 *
 * Demonstrates: wallet auth message generation, public key validation, balance lookup,
 * stroops/XLM conversion utilities, explorer URLs, fee calculation.
 *
 * Run: npx tsx examples/wallet-integration.ts
 */

import {
  WalletClient,
  StellarNetwork,
  stroopsToXlm,
  xlmToStroops,
  isValidStellarPublicKey,
  formatStellarAddress,
  getExplorerUrl,
  calculateFee,
  calculateNetAmount,
} from '../src';

const VALID_PUBLIC_KEY = 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234';

async function main() {
  console.log('👛 EPay SDK — Stellar Wallet Integration Example\n');

  // ══════════════════════════════════════════════════════════════════
  // WALLET CLIENT
  // ══════════════════════════════════════════════════════════════════

  console.log('── Wallet Client ──\n');

  const wallet = new WalletClient({
    network: StellarNetwork.TESTNET,
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  });

  // 1. Validate public keys
  console.log('1. Public key validation:');
  console.log(`   ${VALID_PUBLIC_KEY}: ${wallet.validatePublicKey(VALID_PUBLIC_KEY)}`);
  console.log(`   "invalid_key": ${wallet.validatePublicKey('invalid_key')}\n`);

  // 2. Generate an auth message
  console.log('2. Auth message generation:');
  const authMessage = wallet.generateAuthMessage(VALID_PUBLIC_KEY);
  console.log(`   ${authMessage.replace(/\n/g, '\n   ')}\n`);

  // 3. Build a WalletAuth payload
  console.log('3. Building WalletAuth payload:');
  const auth = wallet.buildWalletAuth({
    publicKey: VALID_PUBLIC_KEY,
    signature: '0xsignature...',
    message: authMessage,
    provider: 'freighter',
  });
  console.log(`   PublicKey:     ${auth.publicKey}`);
  console.log(`   Network:       ${auth.network}`);
  console.log(`   WalletProvider: ${auth.walletProvider}\n`);

  // 4. Supported wallets
  console.log('4. Supported wallets:');
  for (const w of WalletClient.getSupportedWallets()) {
    console.log(`   - ${w}`);
  }
  console.log();

  // ══════════════════════════════════════════════════════════════════
  // STELLAR UTILITIES
  // ══════════════════════════════════════════════════════════════════

  console.log('── Stellar Utilities ──\n');

  // 5. stroops ↔ XLM conversion
  console.log('5. Unit conversion:');
  console.log(`   stroopsToXlm('10000000')  = "${stroopsToXlm('10000000')}"`);
  console.log(`   stroopsToXlm('15000000')  = "${stroopsToXlm('15000000')}"`);
  console.log(`   stroopsToXlm('100')       = "${stroopsToXlm('100')}"`);
  console.log(`   xlmToStroops('1')         = "${xlmToStroops('1')}"`);
  console.log(`   xlmToStroops('1.5')       = "${xlmToStroops('1.5')}"`);
  console.log(`   xlmToStroops('0.0000001') = "${xlmToStroops('0.0000001')}"`);
  console.log(`   Roundtrip: stroopsToXlm(xlmToStroops('1')) = "${stroopsToXlm(xlmToStroops('1'))}"\n`);

  // 6. Address formatting
  console.log('6. Address formatting:');
  console.log(`   formatStellarAddress("${VALID_PUBLIC_KEY}")     = "${formatStellarAddress(VALID_PUBLIC_KEY)}"`);
  console.log(`   formatStellarAddress("${VALID_PUBLIC_KEY}", 4, 6) = "${formatStellarAddress(VALID_PUBLIC_KEY, 4, 6)}"\n`);

  // 7. Explorer URLs
  console.log('7. Explorer URLs:');
  console.log(`   Public tx:      ${getExplorerUrl('tx', '0xhash...', StellarNetwork.PUBLIC)}`);
  console.log(`   Testnet tx:     ${getExplorerUrl('tx', '0xhash...', StellarNetwork.TESTNET)}`);
  console.log(`   Public account: ${getExplorerUrl('account', 'GABCDEF...', StellarNetwork.PUBLIC)}\n`);

  // 8. Fee calculation
  console.log('8. Fee calculation (0.5% = 50 bps):');
  const amount = '10000000'; // 1 XLM in stroops
  console.log(`   Amount:         ${stroopsToXlm(amount)} XLM`);
  console.log(`   Fee (0.5%):     ${stroopsToXlm(calculateFee(amount, 50))} XLM`);
  console.log(`   Net amount:     ${stroopsToXlm(calculateNetAmount(amount, 50))} XLM`);

  console.log('\n   Fee calculation (2% = 200 bps):');
  console.log(`   Amount:         ${stroopsToXlm(amount)} XLM`);
  console.log(`   Fee (2%):       ${stroopsToXlm(calculateFee(amount, 200))} XLM`);
  console.log(`   Net amount:     ${stroopsToXlm(calculateNetAmount(amount, 200))} XLM\n`);

  console.log('✨ Stellar wallet integration examples completed!');
}

main().catch(console.error);
