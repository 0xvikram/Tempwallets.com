/**
 * Custom Wagmi transport that routes transaction signing to backend API
 * 
 * NOTE: This is a placeholder. Backend transaction signing will be handled
 * through AppKit's request handlers or via custom connector integration.
 * The actual implementation will depend on how AppKit handles transaction requests.
 */

import type { BackendTransportConfig } from '../types';

/**
 * Placeholder for backend transport integration
 * 
 * TODO: Implement backend transport integration once AppKit's transaction
 * request flow is understood. This may involve:
 * - Custom connector for backend signing
 * - Intercepting AppKit's request handlers
 * - Or using AppKit's built-in request handling with backend API
 */
export function createBackendTransport(
  config: BackendTransportConfig
) {
  // Placeholder - will be implemented based on AppKit's transaction flow
  console.log('Backend transport config:', config);
  return null;
}

