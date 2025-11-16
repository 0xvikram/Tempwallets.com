/**
 * EVM/Wagmi configuration for AppKit
 */

import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, base, arbitrum, polygon, avalanche } from '@reown/appkit/networks';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set in environment variables');
}

// Supported EVM networks
export const evmNetworks = [mainnet, base, arbitrum, polygon, avalanche];

// Metadata for the wallet
const metadata = {
  name: 'Tempwallets',
  description: 'Temporary wallet service',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://tempwallets.com',
  icons: [
    typeof window !== 'undefined'
      ? `${window.location.origin}/tempwallets-logo.png`
      : 'https://tempwallets.com/tempwallets-logo.png',
  ],
};

/**
 * Creates the Wagmi adapter for EVM chains
 */
export function createEVMAdapter(): WagmiAdapter {
  return new WagmiAdapter({
    networks: evmNetworks,
    projectId: projectId as string,
    ssr: true, // Support SSR for Next.js
  });
}

/**
 * Gets the metadata for AppKit
 */
export function getEVMMetadata() {
  return metadata;
}

