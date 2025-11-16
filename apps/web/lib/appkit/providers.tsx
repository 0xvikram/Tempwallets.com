'use client';

/**
 * AppKit Providers Setup
 * 
 * This component sets up AppKit with all necessary providers.
 * Must be called outside React components per AppKit documentation.
 */

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { createAppKit } from '@reown/appkit/react';
import { createAppKitConfig } from './config';
import { createEVMAdapter, evmNetworks } from './config/evm.config';

// Get project ID
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set in environment variables');
}

// Get metadata
const { metadata } = createAppKitConfig();

// Create Wagmi adapter
const wagmiAdapter = createEVMAdapter();

// Initialize AppKit (must be called outside React components)
// Type assertion needed because AppKit expects a tuple type
// Note: AppKit with WagmiAdapter is designed for DApps
// For wallet applications connecting to DApps, we'll use a custom QR scanner
createAppKit({
  adapters: [wagmiAdapter],
  networks: evmNetworks as any,
  projectId,
  metadata,
  features: {
    analytics: true, // Optional - defaults to your Cloud configuration
  },
});

/**
 * AppKit Providers Component
 * Wraps the app with necessary providers for AppKit and Wagmi
 */
export function AppKitProviders({ children }: { children: React.ReactNode }) {
  // Create QueryClient with useState to avoid recreating on every render
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiAdapter.wagmiConfig}>
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  );
}

