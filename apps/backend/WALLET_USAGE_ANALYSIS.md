# Wallet Usage Analysis: Lightning Node vs Dashboard

## Summary

**TL;DR**: The Lightning Node service uses the **same wallet address** as the dashboard, but:
- Dashboard uses **EIP-7702 gasless** transactions (no ETH needed)
- Lightning Node uses **direct EOA** transactions (requires ETH for gas)
- **No UI approval flow** - all transactions are backend-driven using the seed phrase

---

## Current Implementation

### 1. Wallet Address (Same for Both)

**Location**: `lightning-node.service.ts:75-126` (`getUserWalletAddress`)

```typescript
// Gets wallet address from WalletService (same as dashboard)
const allAddresses = await this.walletService.getAddresses(userId);
const walletAddress = allAddresses[baseChain]; // e.g., 'base'
```

✅ **Same address** - Both dashboard and Lightning Node use the same wallet address derived from the same seed phrase.

---

### 2. EIP-7702 Status

**Dashboard** (Frontend):
- Uses EIP-7702 gasless transactions via `/wallet/eip7702/send`
- No ETH balance required (gas is sponsored)

**Lightning Node** (Backend):
- **Explicitly bypasses EIP-7702** - See `lightning-node.service.ts:82-87`:
  ```typescript
  if (this.pimlicoConfig.isEip7702Enabled(baseChain)) {
    this.logger.warn(
      `EIP-7702 is enabled on ${baseChain}, but Lightning Node requires direct EOA signing. ` +
      `Proceeding with the EOA (no delegation/UserOp).`,
    );
  }
  ```
- Uses raw EOA wallet created from seed phrase
- **Requires ETH balance** for gas fees

---

### 3. Transaction Signing

**Location**: `lightning-node.service.ts:369-379`

```typescript
// Creates EOA account directly from seed phrase
const account = mnemonicToAccount(seedPhrase, {
  accountIndex: 0,
  addressIndex: 0,
});

// Creates wallet client with EOA (no EIP-7702)
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(rpcUrl),
});
```

**Key Points**:
- ✅ Same address as dashboard
- ❌ **No EIP-7702** - Uses raw EOA signing
- ❌ **No UI approval** - Backend signs directly with seed phrase
- ❌ **Requires ETH** - Direct transactions need gas

---

### 4. The Error

From terminal logs:
```
insufficient funds for gas * price + value: 
  have 2010000000000000 wei (0.00201 ETH)
  want 2099680500000000 wei (0.00209968 ETH)
```

**Root Cause**:
1. Channel creation needs to:
   - Approve ERC20 token (requires gas) ✅ Already approved
   - Deposit to Custody contract (requires gas) ❌ **FAILED - Not enough ETH**

2. The EOA wallet has **0.00201 ETH** but needs **0.00209968 ETH** for gas.

---

## Why This Happens

### Dashboard Flow (Gasless):
```
User clicks "Send" → Frontend → /wallet/eip7702/send → 
EIP-7702 Smart Account → UserOp → Gas Sponsored ✅
```

### Lightning Node Flow (Direct EOA):
```
User calls fundChannel → Backend → Seed Phrase → 
EOA Wallet → Direct Transaction → Needs ETH ❌
```

---

## Solutions

### Option 1: Use EIP-7702 Gasless for Deposits/Approvals (Recommended)

**Modify**: `channel-service.ts` `depositFunds()` method

Instead of:
```typescript
const walletClient = createWalletClient({ account, ... });
await walletClient.writeContract({ ... }); // Direct transaction
```

Use:
```typescript
// Use WalletService.sendEip7702Gasless() for approvals/deposits
await this.walletService.sendEip7702Gasless(
  userId,
  chainId,
  custodyAddress, // Recipient
  amount.toString(),
  token, // For ERC20 deposits
);
```

**Benefits**:
- ✅ No ETH required
- ✅ Consistent with dashboard
- ✅ Same gasless experience

**Challenges**:
- Need to adapt `depositFunds()` to work with gasless flow
- May need to expose deposit/approve as separate gasless operations

---

### Option 2: Add UI Gas Approval (Current Pattern for Other Features)

**Frontend Flow**:
1. User initiates fund channel
2. Backend estimates gas cost
3. Frontend shows approval modal: "Approve 0.002 ETH for gas?"
4. User approves → Backend executes transaction

**Implementation**:
- Add `/lightning-node/fund-channel/prepare` endpoint (estimates gas)
- Frontend shows approval modal
- User approves → Call `/lightning-node/fund-channel/execute` (signs and sends)

**Benefits**:
- ✅ User aware of gas costs
- ✅ Explicit approval before spending

**Downsides**:
- ❌ Still requires ETH balance
- ❌ More complex flow
- ❌ Not consistent with dashboard gasless pattern

---

### Option 3: Auto-Fund EOA from EIP-7702 (Hybrid)

**Strategy**:
1. Check if EIP-7702 is enabled
2. If enabled and EOA needs ETH:
   - Use gasless transaction to send ETH from EIP-7702 account to EOA
   - Then use EOA for Lightning Node operations

**Benefits**:
- ✅ Keeps Lightning Node using EOA (as designed)
- ✅ Leverages gasless for funding

**Downsides**:
- ❌ Complex state management
- ❌ Requires maintaining ETH balance

---

## Recommended Solution: Option 1 (EIP-7702 Gasless)

**Why**:
1. **Consistency**: Dashboard already uses gasless for everything
2. **No ETH requirement**: Users don't need to manage ETH balance
3. **Better UX**: Seamless experience, no gas approval needed
4. **Future-proof**: Aligns with account abstraction trends

**Implementation Steps**:

1. **Add gasless deposit method** to `WalletService`:
   ```typescript
   async depositToCustodyGasless(
     userId: string,
     chainId: number,
     channelId: Hash,
     token: Address,
     amount: bigint,
   ): Promise<Hash>
   ```

2. **Modify `ChannelService.depositFunds()`** to detect EIP-7702:
   ```typescript
   if (this.pimlicoConfig.isEip7702Enabled(chain)) {
     // Use gasless flow
     return await this.walletService.depositToCustodyGasless(...);
   } else {
     // Use direct EOA (current implementation)
     return await this.directDeposit(...);
   }
   ```

3. **Keep `create()` as-is** (can still use direct EOA if needed, but deposit must be gasless)

---

## Current Status

- ✅ **Same wallet address** - Correct
- ✅ **Seed phrase signing** - Working
- ❌ **No EIP-7702** - Bypassed intentionally
- ❌ **No UI approval** - All backend-driven
- ❌ **Insufficient ETH** - Causing failures

---

## Next Steps

1. **Immediate Fix**: Fund the test wallet with more ETH (short-term)
2. **Proper Fix**: Implement Option 1 (EIP-7702 gasless for deposits/approvals)
3. **Optional Enhancement**: Add UI approval flow if direct EOA is preferred

