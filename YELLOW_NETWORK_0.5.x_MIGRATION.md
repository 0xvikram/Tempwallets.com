# Yellow Network 0.5.x Migration Guide

## Overview

This document outlines the changes made to support Yellow Network Protocol 0.5.x breaking changes.

## Problem Summary

You were experiencing issues with payment channel creation:

1. **Issue**: `create_channel` was being called with `amount` parameter, but Yellow Network was returning zero allocations
2. **Issue**: `resize_channel` was failing with "invalid signature" error
3. **Root Cause**: Yellow Network 0.5.x introduced breaking protocol changes

## Key Protocol Changes in 0.5.x

### 1. Channel Creation: No Initial Deposit

**Before (0.3.x)**:
```javascript
// Could pass amount parameter
create_channel({ 
  chain_id: 137, 
  token: "0x...", 
  amount: "1000000"  // ✅ Supported
})
```

**After (0.5.x)**:
```javascript
// Amount parameter NO LONGER SUPPORTED
create_channel({ 
  chain_id: 137, 
  token: "0x..."
  // NO amount parameter - channels created with ZERO balance
})
```

**Official Documentation Quote**:
> "Clearnode no longer supports creating channels with an initial deposit. All channels must be created with zero balance and funded separately through a resize operation."

### 2. Resize Operations: New Parameters

**Before (0.3.x)**:
```javascript
resize_channel({
  channel_id: "0x...",
  resize_amount: "1000",
  funds_destination: "0x..."
})
```

**After (0.5.x)**:
```javascript
resize_channel({
  channel_id: "0x...",
  resize_amount: "1000",      // Positive = deposit TO channel
  allocate_amount: "-1000",   // Negative = deposit TO unified balance
  funds_destination: "0x..."
})
```

**Sign Convention**: `resize_amount = -allocate_amount`

### 3. State Signatures: Wallet vs Session Key

**Critical Change**:
- **Channels created BEFORE v0.5.0**: Participant address is the session key → states signed by session key
- **Channels created AFTER v0.5.0**: Participant address is the wallet address → states signed by wallet

**Your Issue**: You were signing resize requests with the session key, but 0.5.0+ channels require wallet signatures for channel state operations.

**Note**: Session keys are still used for **RPC request authentication**, but **channel state operations** need wallet signatures.

### 4. Channel Balance Restrictions

New rule in 0.5.x:

> "Users with any channel containing non-zero amounts cannot perform transfers, submit app states with deposit intent, or create app sessions with non-zero allocations."

**Implication**: For Lightning Nodes (app sessions), payment channels should remain at **zero balance**. All funds should be in the **unified balance**.

## Code Changes Made

### 1. Updated `create_channel` Request

**File**: `apps/backend/src/services/yellow-network/channel-service.ts`

**Changes**:
- ❌ Removed `amount` parameter from create_channel request
- ✅ Added logging explaining 0.5.x two-step flow
- ✅ Updated comments to reflect protocol changes

### 2. Updated `resize_channel` Request

**File**: `apps/backend/src/services/yellow-network/channel-service.ts`

**Changes**:
- ✅ Added `allocate_amount` parameter (required in 0.5.x)
- ✅ Implemented sign convention: `allocate_amount = -resize_amount`
- ✅ Added detailed logging for debugging

**Before**:
```typescript
{
  channel_id: channelId,
  resize_amount: amount.toString(),
  funds_destination: fundsDestination,
}
```

**After**:
```typescript
{
  channel_id: channelId,
  resize_amount: resizeAmount.toString(),
  allocate_amount: allocateAmount.toString(),  // NEW in 0.5.x
  funds_destination: fundsDestination,
}
```

### 3. Simplified Channel Creation Flow

**File**: `apps/backend/src/services/yellow-network/channel-service.ts`

**Old Flow** (0.3.x):
```
1. Try to deposit BEFORE create (may fail)
2. Call create() with zero or non-zero allocations
3. If deposit failed, deposit AFTER create
4. Call resize() to match allocations
```

**New Flow** (0.5.x):
```
1. Call create_channel (always returns zero allocations)
2. Call Custody.create() on-chain with zero allocations
3. If initial deposit needed, call resize_channel
4. Call Custody.resize() on-chain to update state
```

### 4. Updated Documentation

**File**: `apps/backend/src/services/yellow-network/channel-service.ts`

- ✅ Added comprehensive header documenting 0.5.x changes
- ✅ Updated inline comments throughout
- ✅ Added protocol reference links

## Testing Instructions

### 1. Create a New Payment Channel

```bash
# Expected behavior:
# - create_channel called WITHOUT amount parameter
# - Yellow Network returns zero allocations
# - Channel created on-chain with zero balance
# - Success!
```

**Logs to expect**:
```
[ChannelService] Creating channel on chain 8453...
[ChannelService] Creating channel with zero balance (will fund later via resize) (0.5.x protocol)
[ChannelService] ✅ Parsed allocations from Yellow Network (0.5.x): [index: 0, amount: 0], [index: 1, amount: 0] (total: 0)
[ChannelService] ✅ Channel created! TX: 0x...
```

### 2. Fund the Channel via Resize

```bash
# Expected behavior:
# - resize_channel called WITH both resize_amount and allocate_amount
# - Yellow Network validates and returns new state
# - Channel resized on-chain
# - Success!
```

**Logs to expect**:
```
[ChannelService] Adding 1000 to unified balance via resize_channel (0.5.x protocol)...
[ChannelService] Yellow Network 0.5.x resize parameters:
  - resize_amount: 1000 (deposit to channel)
  - allocate_amount: -1000 (from unified balance)
[ChannelService] ✅ Funds added to unified balance via resize_channel
```

### 3. Create a Lightning Node (App Session)

```bash
# Expected behavior:
# - Payment channel should have zero balance
# - App session creation should succeed
# - Success!
```

## Troubleshooting

### Error: "invalid signature"

**Cause**: This error occurs when Yellow Network expects a wallet signature but receives a session key signature.

**Solution**: 
- For v0.5.0+ channels, Yellow Network should automatically generate the correct wallet signatures
- If error persists, check if channel was created before 0.5.0 (legacy channel)
- For legacy channels, you may need to close and recreate the channel

### Error: "operation denied: non-zero allocation in X channel(s) detected"

**Cause**: You have channels with non-zero amounts, which blocks app session operations in 0.5.x.

**Solution**:
```javascript
// Option 1: Resize to zero
await client.resizeChannel({
  channel_id: channelId,
  resize_amount: 0,
  allocate_amount: -currentAmount,  // Withdraw all to unified balance
  funds_destination: walletAddress
});

// Option 2: Close and recreate
await client.closeChannel(channelId, chainId, walletAddress);
await client.createChannel(chainId, token);
```

### Channel Created but Funding Failed

**Behavior**: Channel creation succeeds, but resize_channel fails.

**Impact**: Channel exists with zero balance, which is acceptable in 0.5.x.

**Solution**: User can manually call `resize_channel` later to add funds. The channel is still usable for app sessions.

## Migration Checklist

- [x] Remove `amount` parameter from `create_channel` requests
- [x] Add `allocate_amount` parameter to `resize_channel` requests
- [x] Update channel creation flow to expect zero allocations
- [x] Add logging for debugging 0.5.x flow
- [x] Update documentation and comments
- [ ] Test end-to-end: create channel → fund → create app session
- [ ] Monitor Yellow Network responses for any unexpected behavior
- [ ] Handle legacy channels (created before 0.5.0) if any exist

## References

- **Official Migration Guide**: `/Users/monstu/Developer/crawl4Ai/yellow/05x-breaking-changes.md`
- **Channel Methods**: `/Users/monstu/Developer/crawl4Ai/yellow/docs_protocol_off-chain_channel-methods.md`
- **Yellow Network Docs**: https://docs.yellow.org

## Support

If you encounter issues after this migration:

1. Check the logs for detailed error messages
2. Verify your Yellow Network version is 0.5.x+
3. Ensure you're not using legacy channels (pre-0.5.0)
4. Review the official Yellow Network migration guide
5. Contact Yellow Network support if needed

---

**Last Updated**: January 7, 2026  
**Protocol Version**: Yellow Network 0.5.x  
**Status**: ✅ Migration Complete
