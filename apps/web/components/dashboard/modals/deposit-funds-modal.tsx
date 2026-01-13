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
import { Label } from '@repo/ui/components/ui/label';
import { Loader2, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { lightningNodeApi, LightningNode, walletApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface DepositFundsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lightningNode: LightningNode;
  onDepositComplete?: () => void;
}

export function DepositFundsModal({
  open,
  onOpenChange,
  lightningNode,
  onDepositComplete,
}: DepositFundsModalProps) {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userAddressSet, setUserAddressSet] = useState<Set<string>>(new Set());

  // Form state
  const [amount, setAmount] = useState('');

  // Load user's wallet addresses so we can match the participant row correctly.
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;

    (async () => {
      try {
        const payload = await walletApi.getAddresses(userId);
        const addressSet = new Set<string>();

        const push = (addr: string | null | undefined) => {
          if (!addr) return;
          addressSet.add(addr.toLowerCase());
        };

        push(payload.smartAccount?.address);
        Object.values(payload.smartAccount?.chains || {}).forEach(push);
        (payload.auxiliary || []).forEach((w) => push(w.address));

        if (!cancelled) setUserAddressSet(addressSet);
      } catch {
        if (!cancelled) setUserAddressSet(new Set());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Get current user's participant data
  const currentParticipant = lightningNode.participants.find(
    (p) => userAddressSet.has(p.address.toLowerCase())
  );

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setAmount('');
        setError(null);
        setSuccess(false);
      }, 300);
    }
  }, [open]);

  const handleDeposit = async () => {
    setError(null);

    // Validation
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!currentParticipant) {
      setError('You are not a participant in this Lightning Node');
      return;
    }

    if (!userId) {
      setError('User ID not found');
      return;
    }

    setLoading(true);

    try {
      // Convert amount to smallest units (assuming 6 decimals for USDC/USDT)
      const amountInSmallestUnits = (parseFloat(amount) * 1e6).toString();

      const response = await lightningNodeApi.depositFunds({
        userId,
        appSessionId: lightningNode.appSessionId,
        participantAddress: currentParticipant.address,
        amount: amountInSmallestUnits,
        asset: lightningNode.token.toLowerCase(),
      });

      if (response.ok) {
        setSuccess(true);

        // Notify parent to refresh data
        if (onDepositComplete) {
          onDepositComplete();
        }

        // Close modal after 1.5 seconds
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        setError('Failed to deposit funds. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deposit funds');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Deposit Funds</DialogTitle>
          <DialogDescription>
            Add funds to your Lightning Node from your unified balance. This operation is gasless.
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
            <span>Funds deposited successfully!</span>
          </div>
        )}

        {!success && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({lightningNode.token})</Label>
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
                Funds will be moved from your unified balance to this Lightning Node
              </p>
            </div>

            {currentParticipant && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Current Balance</p>
                <p className="text-lg font-medium text-gray-900">
                  {(Number(currentParticipant.balance) / 1e6).toFixed(2)} {lightningNode.token}
                </p>
              </div>
            )}
          </div>
        )}

        {success && (
          <div className="py-4">
            <p className="text-sm text-gray-600 text-center">
              Your deposit has been processed. The Lightning Node balance will update shortly.
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
                onClick={handleDeposit}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Depositing...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Deposit
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

