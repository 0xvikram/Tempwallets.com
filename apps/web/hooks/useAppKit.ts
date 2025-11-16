'use client';

/**
 * AppKit Hook
 * 
 * Replaces useWalletConnect with AppKit hooks.
 * Provides a similar API surface for easy migration.
 */

import { useAppKitAccount, useAppKit as useAppKitModal } from '@reown/appkit/react';
import { useBrowserFingerprint } from './useBrowserFingerprint';
import { walletApi, ApiError, WalletConnectNamespacePayload } from '@/lib/api';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useConnectors } from 'wagmi';
import type { SessionTypes } from '@walletconnect/types';

const DEFAULT_WALLETCONNECT_METHODS = [
  'eth_sendTransaction',
  'eth_signTransaction',
  'eth_sign',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
];

const DEFAULT_WALLETCONNECT_EVENTS = ['chainChanged', 'accountsChanged'];

const SUPPORTED_WALLETCONNECT_CHAINS = [
  'eip155:1',      // Ethereum
  'eip155:8453',   // Base
  'eip155:42161',  // Arbitrum
  'eip155:137',    // Polygon
  'eip155:43114',  // Avalanche
];

export interface UseAppKitReturn {
  // Connection state
  isConnected: boolean;
  address: string | undefined;
  isInitializing: boolean;
  error: string | null;
  
  // Actions
  open: () => void;
  close: () => void;
  disconnect: () => Promise<void>;
  pair: (uri: string) => Promise<void>;
}

/**
 * Hook to use AppKit for DApp connections
 * 
 * This hook wraps AppKit's hooks and integrates with the backend
 * to fetch wallet accounts and handle user identification.
 */
export function useAppKit(): UseAppKitReturn {
  const { fingerprint } = useBrowserFingerprint();
  const { address, isConnected } = useAppKitAccount();
  const { open: openModal, close } = useAppKitModal();
  const connectors = useConnectors();
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const walletConnectClientRef = useRef<any>(null);
  const sessionProposalListenerSetup = useRef(false);

  // Initialize: Fetch accounts from backend when user ID is available
  useEffect(() => {
    if (!fingerprint) {
      setIsInitializing(false);
      return;
    }

    const initializeAccounts = async () => {
      try {
        setError(null);
        // Fetch WalletConnect accounts from backend
        // This ensures the wallet exists and addresses are available
        await walletApi.getWalletConnectAccounts(fingerprint);
        setIsInitializing(false);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
          // Wallet doesn't exist, create it
          try {
            await walletApi.createOrImportSeed({ userId: fingerprint, mode: 'random' });
            // Retry fetching accounts
            await walletApi.getWalletConnectAccounts(fingerprint);
            setIsInitializing(false);
          } catch (createErr) {
            const errorMessage =
              createErr instanceof Error ? createErr.message : 'Failed to initialize wallet';
            setError(errorMessage);
            setIsInitializing(false);
          }
        } else {
          const errorMessage = err instanceof Error ? err.message : 'Failed to initialize';
          setError(errorMessage);
          setIsInitializing(false);
        }
      }
    };

    initializeAccounts();
  }, [fingerprint]);

  // Helper function to get WalletConnect client from connector
  const getWalletConnectClient = useCallback((connector: any): any => {
    if (connector._client) {
      return connector._client;
    }
    if (connector.provider?.client) {
      return connector.provider.client;
    }
    if (connector.provider?.signer?.client) {
      return connector.provider.signer.client;
    }
    // Try deeper inspection
    if (connector.provider?._client) {
      return connector.provider._client;
    }
    return null;
  }, []);

  // Setup session proposal listener after connectors are available
  useEffect(() => {
    if (sessionProposalListenerSetup.current || !fingerprint || connectors.length === 0) {
      return;
    }


    const setupSessionProposalListener = () => {
      // Find WalletConnect connector
      const walletConnectConnector = connectors.find(
        (connector: any) => 
          connector.id === 'walletConnect' || 
          connector.id === 'reown' ||
          connector.name?.toLowerCase().includes('walletconnect') ||
          connector.name?.toLowerCase().includes('reown')
      );

      if (!walletConnectConnector) {
        return;
      }


      const connectorAny = walletConnectConnector as any;
      
      // Try to get the WalletConnect client
      const client = getWalletConnectClient(connectorAny);

      if (!client) {
        return;
      }

      if (!client.on) {
        return;
      }

      // Check if listener is already set up
      if (walletConnectClientRef.current === client) {
        return;
      }

      walletConnectClientRef.current = client;
      sessionProposalListenerSetup.current = true;


      // Listen for session proposals
      client.on('session_proposal', async (event: any) => {
        const { id, params } = event;

        try {
          // Fetch wallet accounts from backend
          const namespacePayload = await walletApi.getWalletConnectAccounts(fingerprint);

          // Build namespaces for approval
          const namespaces: SessionTypes.Namespaces = {};
          const requestedChains: string[] = [];

          // Helper to extract chains from namespace data
          const extractChains = (namespaceKey: string, namespaceData: any): string[] => {
            if (Array.isArray(namespaceData?.chains)) {
              return namespaceData.chains;
            }
            if (typeof namespaceData?.chains === 'string') {
              return [namespaceData.chains];
            }
            if (Array.isArray(namespaceData?.accounts)) {
              return namespaceData.accounts
                .map((acc: string) => {
                  const parts = acc.split(':');
                  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : null;
                })
                .filter((c: string | null): c is string => c !== null);
            }
            // Default to backend-supported chains if none specified
            if (namespaceKey === namespacePayload.namespace) {
              return namespacePayload.chains;
            }
            return [];
          };

          // Process required namespaces
          if (params.requiredNamespaces) {
            Object.keys(params.requiredNamespaces).forEach((namespaceKey) => {
              if (namespaceKey !== namespacePayload.namespace) {
                return;
              }

              const namespaceData = params.requiredNamespaces[namespaceKey];
              const chains = extractChains(namespaceKey, namespaceData);
              
              // Filter to supported chains
              const supportedChains = chains.filter((chain) => 
                SUPPORTED_WALLETCONNECT_CHAINS.includes(chain)
              );

              if (supportedChains.length === 0) {
                return;
              }

              // Build accounts for each supported chain
              const accounts: string[] = [];
              supportedChains.forEach((chain) => {
                requestedChains.push(chain);
                const address = namespacePayload.addressesByChain[chain];
                if (address) {
                  accounts.push(`${chain}:${address}`);
                }
              });

              if (accounts.length > 0) {
                namespaces[namespaceKey] = {
                  chains: supportedChains,
                  accounts,
                  methods: Array.isArray(namespaceData.methods) && namespaceData.methods.length > 0
                    ? namespaceData.methods
                    : DEFAULT_WALLETCONNECT_METHODS,
                  events: Array.isArray(namespaceData.events) && namespaceData.events.length > 0
                    ? namespaceData.events
                    : DEFAULT_WALLETCONNECT_EVENTS,
                };
              }
            });
          }

          // Check if we have valid namespaces
          if (Object.keys(namespaces).length === 0) {
            throw new Error('No valid accounts found for requested chains');
          }

          // Approve the session
          await client.approve({
            id,
            namespaces,
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to approve session';
          
          // Reject the proposal
          try {
            await client.reject({
              id,
              reason: {
                code: 6001,
                message: errorMessage,
              },
            });
          } catch (rejectErr) {
          }
        }
      });

    };

    // Try to set up immediately, then retry with delay if needed
    setupSessionProposalListener();
    
    // Also retry after a short delay in case connector wasn't fully ready
    const timeoutId = setTimeout(() => {
      if (!sessionProposalListenerSetup.current) {
        setupSessionProposalListener();
      }
    }, 1000);
    
    return () => {
      clearTimeout(timeoutId);
      if (walletConnectClientRef.current && walletConnectClientRef.current.off) {
        try {
          walletConnectClientRef.current.off('session_proposal', () => {});
        } catch (err) {
        }
      }
    };
  }, [connectors, fingerprint, getWalletConnectClient]);

  // Use useCallback to ensure open function has proper context
  // This prevents "Illegal invocation" errors by maintaining the correct 'this' binding
  const open = useCallback(() => {
    try {
      // Call the open function from the hook directly
      // The hook ensures proper context binding
      openModal();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to open AppKit modal';
      setError(errorMessage);
    }
  }, [openModal]);

  const disconnect = async () => {
    try {
      setError(null);
      // AppKit handles disconnection internally
      // We just need to close the modal if open
      close();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const pair = async (uri: string) => {
    try {
      setError(null);
      
      
      // Validate URI format
      if (!uri.trim()) {
        throw new Error('Please enter a WalletConnect URI');
      }

      if (!uri.startsWith('wc:')) {
        throw new Error('Invalid WalletConnect URI. Must start with "wc:"');
      }


      // Find the WalletConnect connector from Wagmi
      const walletConnectConnector = connectors.find(
        (connector: any) => 
          connector.id === 'walletConnect' || 
          connector.id === 'reown' ||
          connector.name?.toLowerCase().includes('walletconnect') ||
          connector.name?.toLowerCase().includes('reown')
      );

      if (!walletConnectConnector) {
        throw new Error('WalletConnect connector not found. Please ensure AppKit is properly initialized.');
      }


      // Access the underlying WalletConnect client from the connector
      const connectorAny = walletConnectConnector as any;
      
      // Get the client using the same helper function
      const client = getWalletConnectClient(connectorAny);
      

      // Ensure session proposal listener is set up before pairing
      if (!sessionProposalListenerSetup.current && client) {
        walletConnectClientRef.current = client;
        sessionProposalListenerSetup.current = true;

        // Set up the listener
        client.on('session_proposal', async (event: any) => {
          const { id, params } = event;

          if (!fingerprint) {
            try {
              await client.reject({
                id,
                reason: {
                  code: 6001,
                  message: 'User identification not available',
                },
              });
            } catch (rejectErr) {
            }
            return;
          }

          try {
            // Fetch wallet accounts from backend
            const namespacePayload = await walletApi.getWalletConnectAccounts(fingerprint);

            // Build namespaces for approval (reuse the same logic)
            const namespaces: SessionTypes.Namespaces = {};
            const requestedChains: string[] = [];

            const extractChains = (namespaceKey: string, namespaceData: any): string[] => {
              if (Array.isArray(namespaceData?.chains)) {
                return namespaceData.chains;
              }
              if (typeof namespaceData?.chains === 'string') {
                return [namespaceData.chains];
              }
              if (Array.isArray(namespaceData?.accounts)) {
                return namespaceData.accounts
                  .map((acc: string) => {
                    const parts = acc.split(':');
                    return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : null;
                  })
                  .filter((c: string | null): c is string => c !== null);
              }
              if (namespaceKey === namespacePayload.namespace) {
                return namespacePayload.chains;
              }
              return [];
            };

            if (params.requiredNamespaces) {
              Object.keys(params.requiredNamespaces).forEach((namespaceKey) => {
                if (namespaceKey !== namespacePayload.namespace) {
                  return;
                }

                const namespaceData = params.requiredNamespaces[namespaceKey];
                const chains = extractChains(namespaceKey, namespaceData);
                
                const supportedChains = chains.filter((chain) => 
                  SUPPORTED_WALLETCONNECT_CHAINS.includes(chain)
                );

                if (supportedChains.length === 0) {
                  return;
                }

                const accounts: string[] = [];
                supportedChains.forEach((chain) => {
                  requestedChains.push(chain);
                  const address = namespacePayload.addressesByChain[chain];
                  if (address) {
                    accounts.push(`${chain}:${address}`);
                  } else {
                  }
                });

                if (accounts.length > 0) {
                  namespaces[namespaceKey] = {
                    chains: supportedChains,
                    accounts,
                    methods: Array.isArray(namespaceData.methods) && namespaceData.methods.length > 0
                      ? namespaceData.methods
                      : DEFAULT_WALLETCONNECT_METHODS,
                    events: Array.isArray(namespaceData.events) && namespaceData.events.length > 0
                      ? namespaceData.events
                      : DEFAULT_WALLETCONNECT_EVENTS,
                  };
                }
              });
            }

            if (Object.keys(namespaces).length === 0) {
              throw new Error('No valid accounts found for requested chains');
            }

            await client.approve({
              id,
              namespaces,
            });

          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to approve session';
            
            try {
              await client.reject({
                id,
                reason: {
                  code: 6001,
                  message: errorMessage,
                },
              });
            } catch (rejectErr) {
            }
          }
        });
      }
      
      // Try to pair using the connector's client
      if (!client) {
        throw new Error('WalletConnect client not found. Cannot pair with DApp.');
      }

      if (client.pair) {
        await client.pair({ uri });
      } else {
        throw new Error('Client does not have a pair method. Check console for client structure.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pair with DApp';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  return {
    isConnected: isConnected ?? false,
    address,
    isInitializing,
    error,
    open,
    close,
    disconnect,
    pair,
  };
}

