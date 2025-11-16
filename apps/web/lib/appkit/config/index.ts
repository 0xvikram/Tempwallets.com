/**
 * Main AppKit configuration aggregator
 * Combines all blockchain adapters (EVM, Solana, Bitcoin)
 */

import { createEVMAdapter, evmNetworks, getEVMMetadata } from './evm.config';
// import { createSolanaAdapter, solanaNetworks } from './solana.config';
// import { createBitcoinAdapter, bitcoinNetworks } from './bitcoin.config';
import type { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

/**
 * Creates AppKit configuration with all adapters
 */
export function createAppKitConfig() {
  const adapters: WagmiAdapter[] = [
    createEVMAdapter(),
    // createSolanaAdapter(), // Future
    // createBitcoinAdapter(), // Future
  ];

  const networks = [
    ...evmNetworks,
    // ...solanaNetworks, // Future
    // ...bitcoinNetworks, // Future
  ];

  const metadata = getEVMMetadata();

  return {
    adapters,
    networks,
    metadata,
  };
}

