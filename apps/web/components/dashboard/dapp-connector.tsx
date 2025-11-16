'use client';

/**
 * DApp Connector Component
 * 
 * Uses AppKit's built-in UI components for wallet connections.
 * AppKit handles all UI including QR scanning, connection flow, and session management.
 * Includes fallback manual URI input for desktop connections without camera.
 */

import { useState } from 'react';
import { useAppKit } from '@/hooks/useAppKit';
import { Loader2, Link, Copy, Check } from 'lucide-react';
import { QRScanner } from './qr-scanner';

export function DAppConnector() {
  const { isInitializing, error, isConnected, address, pair } = useAppKit();
  const [uriInput, setUriInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handlePair = async (uri?: string) => {
    const uriToPair = uri || uriInput;
    
    console.log('[DAppConnector] handlePair called with URI:', uriToPair?.substring(0, 50) + '...');
    
    if (!uriToPair.trim()) {
      setPairError('Please enter a WalletConnect URI');
      return;
    }

    if (!uriToPair.startsWith('wc:')) {
      setPairError('Invalid WalletConnect URI. Must start with "wc:"');
      return;
    }

    setIsPairing(true);
    setPairError(null);

    try {
      console.log('[DAppConnector] Calling pair function...');
      await pair(uriToPair);
      console.log('[DAppConnector] Pair function completed successfully');
      setUriInput(''); // Clear input on success
      setShowManualInput(false); // Hide manual input after successful connection
      setShowQRScanner(false); // Close QR scanner after successful connection
    } catch (err) {
      console.error('[DAppConnector] Error in handlePair:', err);
      setPairError(err instanceof Error ? err.message : 'Failed to connect to DApp');
    } finally {
      setIsPairing(false);
    }
  };

  const handleQRScan = (scannedUri: string) => {
    // When QR code is scanned, automatically pair with it
    handlePair(scannedUri);
  };

  const handleCopy = () => {
    if (uriInput) {
      navigator.clipboard.writeText(uriInput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isInitializing) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
        <div className="flex items-center justify-center space-x-2 text-white">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Initializing AppKit...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
      <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
        <Link className="h-5 w-5" />
        Connect to DApp
      </h3>

      {/* Error Display */}
      {(error || pairError) && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-red-200 text-sm">{error || pairError}</p>
        </div>
      )}

      {/* Connect Button - Opens QR Scanner for wallet to scan DApp QR codes */}
      <div className="mb-4">
        <button
          onClick={() => setShowQRScanner(true)}
          className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <Link className="h-4 w-4" />
          Connect to DApp
        </button>
      </div>

      {/* QR Scanner Modal - For scanning DApp QR codes */}
      {showQRScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      )}

      {/* Manual URI Input Fallback */}
      <div className="mb-4">
        <button
          onClick={() => setShowManualInput(!showManualInput)}
          className="text-sm text-white/60 hover:text-white/80 underline"
          type="button"
        >
          {showManualInput ? 'Hide' : 'Show'} manual URI input
        </button>

        {showManualInput && (
          <div className="mt-3 p-4 bg-white/5 border border-white/20 rounded-lg">
            <label className="block text-sm font-medium text-white/80 mb-2">
              Paste WalletConnect URI manually
            </label>
            <p className="text-xs text-white/60 mb-3">
              Copy the WalletConnect URI from the DApp and paste it here (useful when camera is not available)
            </p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={uriInput}
                  onChange={(e) => {
                    setUriInput(e.target.value);
                    setPairError(null);
                  }}
                  onPaste={(e) => {
                    const pastedText = e.clipboardData.getData('text');
                    if (pastedText.startsWith('wc:')) {
                      setUriInput(pastedText);
                      setPairError(null);
                    }
                  }}
                  placeholder="wc://..."
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 font-mono text-sm"
                />
                {uriInput && (
                  <button
                    onClick={handleCopy}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded text-white/60 hover:text-white transition-colors"
                    title="Copy URI"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
              <button
                onClick={() => handlePair()}
                disabled={isPairing || !uriInput.trim()}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 disabled:bg-white/10 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {isPairing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Connecting...</span>
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4" />
                    <span className="hidden sm:inline">Connect</span>
                  </>
                )}
              </button>
            </div>
            {uriInput && !uriInput.startsWith('wc:') && (
              <p className="mt-2 text-xs text-yellow-400">
                URI should start with "wc:"
              </p>
            )}
          </div>
        )}
      </div>

      {/* Connection Status */}
      {isConnected && address && (
        <div className="mt-4 p-3 bg-white/5 border border-white/20 rounded-lg">
          <p className="text-sm text-white/80">
            <span className="font-medium">Connected:</span>{' '}
            <span className="font-mono text-xs">{address}</span>
          </p>
        </div>
      )}

      {/* Info Text */}
      {!isConnected && (
        <div className="mt-4 text-center py-4 text-white/60">
          <p>Click the button above to connect to a DApp</p>
          <p className="text-sm mt-2">
            AppKit will handle QR scanning and connection flow automatically
          </p>
        </div>
      )}
    </div>
  );
}
