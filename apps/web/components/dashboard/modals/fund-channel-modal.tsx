'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@repo/ui/components/ui/dialog';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Label } from '@repo/ui/components/ui/label';
import { Loader2, Wallet, CheckCircle2, AlertCircle } from 'lucide-react';
import { lightningNodeApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface FundChannelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chain?: string;
  asset?: string;
  onFundComplete?: () => void;
}

export function FundChannelModal({
  open,
  onOpenChange,
  chain,
  asset,
  onFundComplete,
}: FundChannelModalProps) {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [amount, setAmount] = useState('');
  const [selectedChain, setSelectedChain] = useState(chain || 'base');
  const [selectedAsset, setSelectedAsset] = useState(asset || 'usdc');

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setAmount('');
        setError(null);
        setSuccess(false);
        setSelectedChain(chain || 'base');
        setSelectedAsset(asset || 'usdc');
      }, 300);
    }
  }, [open, chain, asset]);

  const handleFund = async () => {
    setError(null);

    // Validation
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!userId) {
      setError('User ID not found');
      return;
    }

    setLoading(true);

    try {
      const response = await lightningNodeApi.fundChannel({
        userId,
        chain: selectedChain,
        asset: selectedAsset,
        amount,
      });

      if (response.ok) {
        setSuccess(true);

        // Notify parent to refresh data
        if (onFundComplete) {
          onFundComplete();
        }

        // Close modal after 2 seconds
        setTimeout(() => {
          onOpenChange(false);
        }, 2000);
      } else {
        setError('Failed to fund channel. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fund channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Fund Channel (Add to Unified Balance)</DialogTitle>
          <DialogDescription>
            Move funds from your on-chain wallet to the unified balance. This requires an on-chain transaction.
            Funds in unified balance can then be deposited to Lightning Nodes (gasless).
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>Channel funded successfully! Funds are now in your unified balance.</span>
          </div>
        )}

        {!success && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="chain">Chain</Label>
              <Select value={selectedChain} onValueChange={setSelectedChain} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Base</SelectItem>
                  <SelectItem value="arbitrum">Arbitrum</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Select the blockchain network
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset">Asset</Label>
              <Select value={selectedAsset} onValueChange={setSelectedAsset} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usdc">USDC</SelectItem>
                  <SelectItem value="usdt">USDT</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Select the token to add
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({selectedAsset.toUpperCase()})</Label>
              <Input
                id="amount"
                type="number"
                step="0.000001"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
                className="text-lg"
              />
              <p className="text-xs text-gray-500">
                Funds will be moved from your on-chain wallet to unified balance
              </p>
            </div>
          </div>
        )}

        {success && (
          <div className="py-4">
            <p className="text-sm text-gray-600 text-center">
              Your funds are now in the unified balance. You can deposit them to Lightning Nodes without gas fees!
            </p>
          </div>
        )}

        <DialogFooter>
          {!success && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="text-gray-900 border-gray-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleFund}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Funding...
                  </>
                ) : (
                  <>
                    <Wallet className="mr-2 h-4 w-4" />
                    Fund Channel
                  </>
                )}
              </Button>
            </>
          )}
          {success && (
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full bg-black hover:bg-gray-800 text-white"
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

