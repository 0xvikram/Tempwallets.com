# Files to Share for Yellow Network Technical Call

## Core Issue: Channel Creation Lifecycle

### Primary File (Channel Creation Implementation)
**`src/services/yellow-network/channel-service.ts`**
- **Lines 198-712**: `createChannel()` method - Shows the current implementation attempting Flow A (deposit before create)
- **Lines 226-240**: `create_channel` RPC request with `amount` parameter (currently ignored by Yellow Network)
- **Lines 415-433**: Deposit attempt before channel creation (fails because channel doesn't exist)
- **Lines 1016-1091**: `depositFunds()` helper method - ERC20 approval and deposit logic
- **Lines 650-685**: `Custody.create()` call - Where zero allocations cause revert
- **Lines 443-520**: Allocation parsing logic - Shows how Yellow Network returns zero allocations despite `amount` parameter

### Integration Point (How Channel Creation is Called)
**`src/lightning-node/lightning-node.service.ts`**
- **Lines 1743-1750**: `fundChannel()` method - Entry point that calls `createChannel()` with `initialDeposit`
- **Lines 1491-1556**: `deposit()` method - Shows channel creation as part of deposit flow

### Channel Discovery
**`src/services/yellow-network/query-service.ts`**
- **Lines 138-236**: `getChannels()` method - Demonstrates channel discovery implementation

### Session Creation
**`src/services/yellow-network/app-session-service.ts`**
- **Lines 1-200**: `createAppSession()` method - Shows session creation implementation

### Supporting Context
**`src/services/yellow-network/channel-service.ts`**
- **Lines 69-162**: `CUSTODY_ABI` - Contract ABI definitions showing deposit, create, resize, close functions
- **Lines 43-64**: `ERC20_ABI` - Token approval ABI

## Key Questions to Ask

1. **Does `create_channel` RPC accept an `amount` parameter?**
   - Current code sends: `{ chain_id, token, amount: "1000" }`
   - Yellow Network still returns zero allocations in state
   - Should the parameter be named differently or formatted differently?

2. **Can `Custody.deposit()` be called before `Custody.create()`?**
   - Current implementation: deposit() reverts with "channel doesn't exist"
   - Is there a way to pre-deposit funds for a channelId before the channel exists on-chain?

3. **Is there ever a valid case where `Custody.create()` accepts zero allocations?**
   - Or should clients always block zero-allocation creation attempts?

4. **Expected flow for creating a funded channel:**
   - Is it: `create_channel → deposit → create()`?
   - Or: `create_channel(with amount) → create() → deposit → resize()`?
   - Or something else entirely?

## Code Sections to Highlight

### Problem Area (Current Implementation)
```typescript
// channel-service.ts, lines 226-240
const requestParams: any = { 
  chain_id: chainId, 
  token 
};

if (initialDeposit && initialDeposit > BigInt(0)) {
  requestParams.amount = initialDeposit.toString(); // ⚠️ This is ignored
  console.log(`Requesting create_channel with amount: ${initialDeposit.toString()}`);
}
```

### The Revert
```typescript
// channel-service.ts, lines 650-685
const txHash = await this.walletClient.writeContract({
  address: custodyAddress,
  abi: CUSTODY_ABI,
  functionName: 'create',
  args: [
    channelId,
    {
      intent: state.intent,
      version: BigInt(state.version),
      data: state.data,
      allocations: state.allocations, // ⚠️ These are [0, 0] from Yellow Network
    },
    signatures,
  ],
});
// ❌ Reverts because allocations are zero
```

## Quick Context Summary

**What works:**
- ✅ Session creation
- ✅ Channel discovery  
- ✅ Deposit/transfer/withdraw flows (when channel exists)
- ✅ Resize operations

**What's broken:**
- ❌ Initial channel creation with funds
- ❌ The `amount` parameter in `create_channel` appears to be ignored
- ❌ Deposit before create() fails (channel doesn't exist)
- ❌ Create() with zero allocations reverts

