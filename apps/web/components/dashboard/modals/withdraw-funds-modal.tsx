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
import { Loader2, Minus, CheckCircle2, AlertCircle } from 'lucide-react';
import { lightningNodeApi, LightningNode, walletApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface WithdrawFundsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lightningNode: LightningNode;
  onWithdrawComplete?: () => void;
}

export function WithdrawFundsModal({
  open,
  onOpenChange,
  lightningNode,
  onWithdrawComplete,
}: WithdrawFundsModalProps) {
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

  const handleWithdraw = async () => {
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

    // Check if user has sufficient balance
    const amountInSmallestUnits = (parseFloat(amount) * 1e6).toString();
    if (BigInt(amountInSmallestUnits) > BigInt(currentParticipant.balance)) {
      setError('Insufficient balance');
      return;
    }

    setLoading(true);

    try {
      // Note: Withdraw API endpoint needs to be implemented in backend
      // For now, we'll show an error if the endpoint doesn't exist
      const response = await lightningNodeApi.withdrawFunds({
        userId,
        appSessionId: lightningNode.appSessionId,
        participantAddress: currentParticipant.address,
        amount: amountInSmallestUnits,
        asset: lightningNode.token.toLowerCase(),
      });

      if (response.ok) {
        setSuccess(true);

        // Notify parent to refresh data
        if (onWithdrawComplete) {
          onWithdrawComplete();
        }

        // Close modal after 1.5 seconds
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        setError('Failed to withdraw funds. Please try again.');
      }
    } catch (err) {
      // If withdraw endpoint doesn't exist yet, show helpful message
      if (err instanceof Error && err.message.includes('withdrawFunds')) {
        setError('Withdraw functionality is coming soon. Please close the session to withdraw all funds.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to withdraw funds');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Withdraw Funds</DialogTitle>
          <DialogDescription>
            Remove funds from your Lightning Node back to your unified balance. This operation is gasless.
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
            <span>Funds withdrawn successfully!</span>
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
                Funds will be moved from this Lightning Node back to your unified balance
              </p>
            </div>

            {currentParticipant && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Available Balance</p>
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
              Your withdrawal has been processed. The funds will be available in your unified balance shortly.
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
                onClick={handleWithdraw}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Withdrawing...
                  </>
                ) : (
                  <>
                    <Minus className="mr-2 h-4 w-4" />
                    Withdraw
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

