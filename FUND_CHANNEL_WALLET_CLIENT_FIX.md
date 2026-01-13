# Fund Channel Wallet Client Fix

## Issue
**Error**: `Channel funding failed: Wallet client account does not support signing`

This error occurred when users tried to fund a payment channel through the Lightning Node UI.

## Root Cause

The `walletClient` being passed to `NitroliteClient` was incorrectly created as a **public client** and just cast to a `WalletClient` type:

```typescript
// ❌ WRONG - This doesn't support signing
const walletClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
}) as unknown as WalletClient;
```

A public client cannot sign transactions or messages because it doesn't have an account attached. When the Yellow Network SDK tried to use this wallet client to sign the channel creation transaction, it failed with "does not support signing".

## Solution

Created a proper `WalletClient` with the EOA (Externally Owned Account) that has signing capabilities:

```typescript
// ✅ CORRECT - This supports signing
const eoaAccount = await this.createEOASignerAccount(userId, baseChain);

const walletClient = createWalletClient({
  account: eoaAccount, // Attach the EOA account with private key
  chain,
  transport: http(rpcUrl),
}) as WalletClient;
```

## Changes Made

### 1. Added `createWalletClient` Import
**File**: `apps/backend/src/lightning-node/lightning-node.service.ts`

Added the proper viem function to create wallet clients:
```typescript
import {
  createPublicClient,
  createWalletClient, // ← NEW
  http,
  // ...
} from 'viem';
```

### 2. Fixed Wallet Client Creation Order
Moved the EOA account creation **before** the wallet client creation, since we need the account to create the wallet client.

### 3. Created Proper Wallet Client
Replaced the incorrect public client cast with a proper wallet client that includes the EOA account:

```typescript
const walletClient = createWalletClient({
  account: eoaAccount,
  chain,
  transport: http(rpcUrl),
}) as WalletClient;
```

## Why This Works

### Wallet Client vs Public Client

| Client Type | Purpose | Can Sign? | Use Case |
|------------|---------|-----------|----------|
| **PublicClient** | Read blockchain data | ❌ No | Query balances, read contracts |
| **WalletClient** | Write to blockchain | ✅ Yes | Send transactions, sign messages |

### What the Wallet Client Needs

A `WalletClient` needs an **account** with these capabilities:
- `signTransaction()` - Sign blockchain transactions
- `signMessage()` - Sign arbitrary messages
- `signTypedData()` - Sign EIP-712 typed data

The EOA account from `mnemonicToAccount()` provides all of these because it has access to the private key.

## Flow After Fix

### 1. User Clicks "Add Funds to Unified Balance"
- Frontend opens Fund Channel modal
- User selects chain (Base/Arbitrum) and asset (USDC/USDT)
- User enters amount

### 2. Backend Creates Authenticated Client
```typescript
// Get user's seed phrase
const eoaAccount = await this.createEOASignerAccount(userId, chain);
// eoaAccount has access to private key for signing

// Create wallet client with signing capability
const walletClient = createWalletClient({
  account: eoaAccount, // Now has signing methods!
  chain,
  transport: http(rpcUrl),
});

// Create NitroliteClient
const client = new NitroliteClient({
  wsUrl,
  mainWallet,
  publicClient, // For reading
  walletClient, // For writing/signing ✅
  useSessionKeys: true,
});
```

### 3. Channel Creation Process
1. **Query existing channels** - Uses public client (read-only)
2. **Create channel config** - Yellow Network generates channel parameters
3. **Sign channel state** - Uses wallet client account ✅
4. **Submit to blockchain** - Uses wallet client to send transaction ✅
5. **Resize channel** (if needed) - Uses wallet client to add funds ✅

## Testing

### Before Fix
```
❌ Error: Wallet client account does not support signing
```

### After Fix
```
✅ Channel created successfully
✅ Funds added to unified balance
✅ User can now deposit to Lightning Nodes (gasless)
```

## Related Files

- `/apps/backend/src/lightning-node/lightning-node.service.ts` - Main fix location
- `/apps/web/components/dashboard/lightning/lightning-nodes-view.tsx` - UI that triggers this
- `/apps/web/components/dashboard/modals/fund-channel-modal.tsx` - Modal component
- `/apps/backend/src/services/yellow-network/channel-service.ts` - Where signing happens

## Technical Details

### EOA Account Structure
The `mnemonicToAccount()` function returns a viem account with:
```typescript
{
  address: '0x...',
  signTransaction: async (tx) => {...},
  signMessage: async (msg) => {...},
  signTypedData: async (data) => {...},
  // ... other methods
}
```

### Wallet Client Structure
```typescript
{
  account: eoaAccount, // Provides signing methods
  chain: base,         // Chain configuration
  transport: http,     // RPC connection
  // Methods: sendTransaction, writeContract, etc.
}
```

## Important Notes

### Why We Need Both Clients

1. **PublicClient** - Fast, read-only operations
   - Get balances
   - Query smart contracts
   - Check transaction status
   
2. **WalletClient** - Authenticated, write operations
   - Create payment channels
   - Send tokens
   - Sign messages

### EOA vs ERC-4337

The Lightning Node service **requires EOA (direct signing)** because:
- Payment channels need immediate on-chain signatures
- Cannot use UserOperation batching (adds latency)
- Yellow Network expects direct wallet signatures

This is why we create the wallet client with the raw EOA account, not an ERC-4337 smart account.

## Future Improvements

1. **Better Error Messages**
   - Detect signing failures earlier
   - Show user-friendly error messages
   - Suggest solutions (check balance, try different chain)

2. **Transaction Simulation**
   - Simulate transaction before sending
   - Show estimated gas cost
   - Warn if transaction likely to fail

3. **Retry Logic**
   - Auto-retry failed channel creation
   - Handle RPC timeouts gracefully
   - Queue requests during high network congestion

4. **Multi-Signature Support**
   - Support multiple participants funding a channel
   - Coordinate signatures from different users
   - Handle partial signature failures

## Conclusion

The fix was straightforward: use `createWalletClient` with an EOA account instead of casting a public client. This gives the Yellow Network SDK the signing capabilities it needs to create payment channels on-chain.

**Key Takeaway**: When you need to sign transactions or messages, always use `createWalletClient` with an account that has access to a private key. Never cast a `PublicClient` to `WalletClient` - they serve different purposes!
