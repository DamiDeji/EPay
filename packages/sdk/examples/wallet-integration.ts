/**
 * EPay SDK — Wallet Integration Example
 *
 * Demonstrates: wallet auth message generation, address validation, balance lookup,
 * TON conversion utilities, explorer URLs, fee calculation.
 *
 * Run: npx tsx examples/wallet-integration.ts
 */

import {
  WalletClient,
  TONNetwork,
  nanoToTon,
  tonToNano,
  isValidTonAddress,
  formatAddress,
  getExplorerUrl,
  calculateFee,
  calculateNetAmount,
} from '../src';

const VALID_ADDRESS = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAU';

async function main() {
  console.log('👛 EPay SDK — Wallet Integration Example\n');

  // ══════════════════════════════════════════════════════════════════
  // WALLET CLIENT
  // ══════════════════════════════════════════════════════════════════

  console.log('── Wallet Client ──\n');

  const wallet = new WalletClient({
    network: TONNetwork.TESTNET,
    rpcEndpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
  });

  // 1. Validate addresses
  console.log('1. Address validation:');
  console.log(`   ${VALID_ADDRESS}: ${wallet.validateAddress(VALID_ADDRESS)}`);
  console.log(`   "invalid_address": ${wallet.validateAddress('invalid_address')}\n`);

  // 2. Generate an auth message
  console.log('2. Auth message generation:');
  const authMessage = wallet.generateAuthMessage(VALID_ADDRESS);
  console.log(`   ${authMessage.replace(/\n/g, '\n   ')}\n`);

  // 3. Build a WalletAuth payload
  console.log('3. Building WalletAuth payload:');
  const auth = wallet.buildWalletAuth({
    address: VALID_ADDRESS,
    publicKey: '0xabcdef1234567890...',
    signature: '0xsignature...',
    message: authMessage,
  });
  console.log(`   Address:   ${auth.address}`);
  console.log(`   Network:   ${auth.network}`);
  console.log(`   PublicKey: ${auth.publicKey}\n`);

  // ══════════════════════════════════════════════════════════════════
  // TON UTILITIES
  // ══════════════════════════════════════════════════════════════════

  console.log('── TON Utilities ──\n');

  // 4. nanoTON ↔ TON conversion
  console.log('4. Unit conversion:');
  console.log(`   nanoToTon('1000000000')  = "${nanoToTon('1000000000')}"`);
  console.log(`   nanoToTon('1500000000')  = "${nanoToTon('1500000000')}"`);
  console.log(`   nanoToTon('100')         = "${nanoToTon('100')}"`);
  console.log(`   tonToNano('1')           = "${tonToNano('1')}"`);
  console.log(`   tonToNano('1.5')         = "${tonToNano('1.5')}"`);
  console.log(`   tonToNano('0.0000001')   = "${tonToNano('0.0000001')}"`);
  console.log(`   Roundtrip: nanoToTon(tonToNano('1')) = "${nanoToTon(tonToNano('1'))}"\n`);

  // 5. Address formatting
  console.log('5. Address formatting:');
  console.log(`   formatAddress("${VALID_ADDRESS}")     = "${formatAddress(VALID_ADDRESS)}"`);
  console.log(`   formatAddress("${VALID_ADDRESS}", 4, 6) = "${formatAddress(VALID_ADDRESS, 4, 6)}"\n`);

  // 6. Explorer URLs
  console.log('6. Explorer URLs:');
  console.log(`   Mainnet tx:     ${getExplorerUrl('tx', '0xhash...', TONNetwork.MAINNET)}`);
  console.log(`   Testnet tx:     ${getExplorerUrl('tx', '0xhash...', TONNetwork.TESTNET)}`);
  console.log(`   Mainnet addr:   ${getExplorerUrl('address', 'EQD...', TONNetwork.MAINNET)}\n`);

  // 7. Fee calculation
  console.log('7. Fee calculation (0.5% = 50 bps):');
  const amount = '1000000000'; // 1 TON
  console.log(`   Amount:         ${nanoToTon(amount)} TON`);
  console.log(`   Fee (0.5%):     ${nanoToTon(calculateFee(amount, 50))} TON`);
  console.log(`   Net amount:     ${nanoToTon(calculateNetAmount(amount, 50))} TON`);

  console.log('\n   Fee calculation (2% = 200 bps):');
  console.log(`   Amount:         ${nanoToTon(amount)} TON`);
  console.log(`   Fee (2%):       ${nanoToTon(calculateFee(amount, 200))} TON`);
  console.log(`   Net amount:     ${nanoToTon(calculateNetAmount(amount, 200))} TON\n`);

  console.log('✨ Wallet integration examples completed!');
}

main().catch(console.error);
