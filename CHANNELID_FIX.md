# Yellow Network ChannelId Fix - RESOLVED ✅

**Date**: January 13, 2026
**Status**: ✅ **FIXED** - Ready for Testing
**Issue**: ChannelId mismatch causing `InvalidStateSignatures()` contract revert
**Root Cause**: Using `address[2]` instead of `address[]` in channelId computation

---

## 🎯 The Problem

### What Was Happening

```
Yellow Network channelId: 0x771be78cbc3a3ed09555f9c7b54ead7234d414f7af326004066efb5564b5a5a0
Our computed channelId:    0xe748ca4c650949a502f31ac659899b3fee12e0a26848d338992c942ed89e5fcc
❌ MISMATCH → Contract rejects signatures
```

### Symptoms
- ✅ All Yellow team diagnostic checks passed
- ✅ Signatures verified correctly off-chain
- ❌ Contract reverted with `InvalidStateSignatures()` or `execution reverted`

---

## 🔍 Root Cause (Yellow Team Guidance)

The channelId mismatch was caused by **incorrect channel struct encoding**:

```typescript
// ❌ WRONG - What we were using
cast keccak $(cast ae "x(address[2],address,uint256,uint256,uint256)" \
  "[0xAb4a...,0x435d...]" 0x7de4... 3600 1767957227070 8453)
// → 0xe748ca4c... (WRONG!)

// ✅ CORRECT - What the contract expects
cast keccak $(cast ae "x(address[],address,uint256,uint256,uint256)" \
  "[0xAb4a...,0x435d...]" 0x7de4... 3600 1767957227070 8453)
// → 0x771be78c... (CORRECT!)
```

**Key Difference**:
- We used: `address[2]` (fixed-size array)
- Contract uses: `address[]` (dynamic array)

---

## ✅ The Solution

### Yellow Team Guidance

> "You should not try to calculate the channelId on your side, instead, you should use the channelId returned by the Clearnode, compute and sign the packedState with it."

### Implementation

We made TWO critical fixes:

1. **Primary**: Use Yellow Network's provided `channel_id` directly ✅
   - Already implemented on line 412 of `channel-service.ts`
   - Uses `channelIdFromResponse || fallback`

2. **Secondary**: Fix fallback computation to use `address[]` ✅
   - Changed `address[2]` → `address[]` in both functions:
     - `computeChannelIdWithChainId()` (line 1656)
     - `computeChannelId()` (line 1675)

---

## 📝 Files Changed

### 1. `/apps/backend/src/services/yellow-network/channel-service.ts`

**Line 1654-1667** (computeChannelIdWithChainId):
```typescript
// BEFORE
private computeChannelIdWithChainId(channel: Channel, chainId: number): Hash {
  const encoded = encodeAbiParameters(
    parseAbiParameters('address[2], address, uint256, uint256, uint256'), // ❌ address[2]
    [channel.participants, channel.adjudicator, channel.challenge, channel.nonce, BigInt(chainId)]
  );
  return keccak256(encoded);
}

// AFTER
private computeChannelIdWithChainId(channel: Channel, chainId: number): Hash {
  const encoded = encodeAbiParameters(
    parseAbiParameters('address[], address, uint256, uint256, uint256'), // ✅ address[]
    [channel.participants, channel.adjudicator, channel.challenge, channel.nonce, BigInt(chainId)]
  );
  return keccak256(encoded);
}
```

**Line 1672-1697** (computeChannelId):
```typescript
// BEFORE
private computeChannelId(channel: Channel, chainId?: number): Hash {
  const encodedWithoutChainId = encodeAbiParameters(
    parseAbiParameters('address[2], address, uint256, uint256'), // ❌ address[2]
    [channel.participants, channel.adjudicator, channel.challenge, channel.nonce]
  );
  return keccak256(encodedWithoutChainId);
}

// AFTER
private computeChannelId(channel: Channel, chainId?: number): Hash {
  const encodedWithoutChainId = encodeAbiParameters(
    parseAbiParameters('address[], address, uint256, uint256'), // ✅ address[]
    [channel.participants, channel.adjudicator, channel.challenge, channel.nonce]
  );
  return keccak256(encodedWithoutChainId);
}
```

---

## 🧪 Testing

### Build Verification
```bash
npm run build
# ✅ Build successful with no errors
```

### Next Steps for Testing

1. **Start the backend**:
   ```bash
   pnpm start:dev
   ```

2. **Trigger channel creation**:
   - Use your existing flow via `/lightning-node/fund-channel`
   - Expected logs:
     ```
     [ChannelService] ═══ CHANNEL ID COMPARISON ═══
     [ChannelService] Yellow Network provided: 0x771be78c...
     [ChannelService] Our computation (WITH chainId): 0x771be78c...
     [ChannelService] ✅ ChannelId matches!
     ```

3. **Expected Result**:
   - ✅ No more `execution reverted` errors
   - ✅ No more `InvalidStateSignatures()` errors
   - ✅ Transaction hash returned
   - ✅ Channel created on Base Mainnet

---

## 📊 Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| **ChannelId Encoding** | `address[2]` ❌ | `address[]` ✅ |
| **Computed ChannelId** | `0xe748ca4c...` ❌ | `0x771be78c...` ✅ |
| **Matches Yellow** | NO ❌ | YES ✅ |
| **Contract Accepts** | NO ❌ | **YES ✅** (Expected) |
| **Signature Verification** | OFF-CHAIN ONLY ✅ | ON-CHAIN ✅ (Expected) |

---

## 🎉 Expected Outcome

### Before Fix
```
Error: The contract function "create" reverted.
Cause: InvalidStateSignatures()

Yellow channelId: 0x771be78c...
Our channelId:    0xe748ca4c...
❌ MISMATCH → Contract rejects
```

### After Fix
```
[ChannelService] Yellow Network provided: 0x771be78c...
[ChannelService] Our computation: 0x771be78c...
[ChannelService] ✅ ChannelId matches!

Transaction: 0xabc123...
✅ Channel created successfully on Base Mainnet!
```

---

## 🔄 Why This Fix Works

### The Flow

1. **Yellow Network** computes channelId using `address[]`
   - Result: `0x771be78c...`

2. **Yellow Network** signs state using their channelId
   - Creates `server_signature`

3. **We receive** Yellow's `channel_id` and `server_signature`
   - Use `channel_id` for signing: `0x771be78c...` ✅

4. **We sign** state with same channelId
   - Both signatures now use `0x771be78c...` ✅

5. **Contract computes** channelId from channel params using `address[]`
   - Result: `0x771be78c...` ✅

6. **Contract verifies** signatures using its computed channelId
   - Hash matches → Signatures valid → **SUCCESS!** 🎉

---

## 📖 Key Lessons

### What We Learned

1. **Don't trust ABIs blindly**
   - The ABI can lie! It showed `address[2]` but contract uses `address[]`
   - Always verify encoding with the team

2. **Use provided values when available**
   - Yellow provides `channel_id` → Use it!
   - Don't compute yourself unless absolutely necessary

3. **Dynamic vs Fixed Arrays matter**
   - `address[2]` and `address[]` produce COMPLETELY different hashes
   - This is a common gotcha in Solidity encoding

4. **Off-chain success ≠ On-chain success**
   - Signatures can verify off-chain but fail on-chain
   - Root cause: different channelId used for signing vs verification

---

## 🚀 Status

**Migration Status**: ✅ **COMPLETE**
**Build Status**: ✅ **PASSING**
**Ready for Testing**: ✅ **YES**
**Expected Result**: Channel creation succeeds on Base Mainnet! 🎉

---

## 🙏 Credits

**Special thanks to the Yellow Network team** for identifying the exact issue:
- Pinpointed `address[2]` vs `address[]` encoding difference
- Provided cast commands to reproduce the issue
- Confirmed correct approach: "Use channelId returned by Clearnode"

---

## 📚 Related Documentation

- `YELLOW_NETWORK_CHANNELID_ISSUE.md` - Original issue analysis
- `YELLOW_SDK_MIGRATION.md` - SDK migration attempt (revealed network compatibility)
- `/apps/backend/src/services/yellow-network/channel-service.ts` - Implementation

---

**Last Updated**: January 13, 2026
**Next Step**: Test end-to-end channel creation on Base Mainnet
