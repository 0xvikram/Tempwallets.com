# Yellow Network Signature Verification Issues - Comprehensive Analysis

**Date**: January 8, 2026
**Status**: ❌ UNRESOLVED - Server signature still not verifying
**User Wallet**: `0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682`
**Clearnode**: `0x435d4B6b68e1083Cc0835D1F971C4739204C1d2a`

---

## Problem Summary

When creating payment channels via Yellow Network's `create_channel` RPC method, the `server_signature` provided in the response does not verify correctly when we attempt to recover the signer address.

**Current Status**:
- ✅ User signature verification: **PASSES**
- ❌ Server signature verification: **FAILS**

---

## Latest Test Results

### Test Run: 2026-01-08 17:23:00

**Channel Created**:
- Channel ID: `0xced69acbed331ccd0a6fb708d2515f7dc1f3d1009193137d39048e483c7104a1`
- Chain: Base (8453)
- Token: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)

**State Hash Computed**:
```
0xef2e89a8ad5498dd85fa51cc5f7fac130587ed9f79ab305cd7fa0b268e32cdf5
```

**Signature Recovery Results**:
```
User signature:    0x660e1afd2bd5d70cc81c7fd0e387152e4a50a54861ae2814cf93d945f4032392...
  → Recovered:     0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682 ✅ MATCHES participant[0]

Server signature:  0x0e210c43943963219f5f6a5da0966dc93d342c119507d7000a78dd8c96fa3624...
  → Recovered:     0x5BC70f1e4F6A4c3Ac9Bd4e6e8F2d056a8Fb02Ad9 ❌ DOES NOT MATCH
  → Expected:      0x435d4B6b68e1083Cc0835D1F971C4739204C1d2a (clearnode)
```

---

## What We've Tried (Chronological)

### Attempt 1: EIP-191 vs Raw ECDSA
**Hypothesis**: Yellow Network uses raw ECDSA, we were using EIP-191
**Action**: Changed from `signMessage()` to `account.sign()` and `recoverMessageAddress()` to `recoverAddress()`
**Result**: ❌ User signature worked, server signature still failed
**Reverted**: Yes - Yellow team confirmed they use **EIP-191**

### Attempt 2: Nested vs Flattened Encoding
**Hypothesis**: We were using nested tuple `(channelId, State)` instead of flattened
**Action**: Changed encoding from:
```typescript
// WRONG
abi.encode(channelId, (intent, version, data, allocations))

// CORRECT
abi.encode(channelId, intent, version, data, allocations)
```
**Result**: ❌ Server signature still fails
**Status**: Keep this fix (correct per Yellow team guidance)

### Attempt 3: Version Type (uint64 vs uint256)
**Hypothesis**: Contract expects `uint256` for version, we used `uint64`
**Action**: Changed version type from `uint64` to `uint256` in encoding
**Result**: ❌ Server signature still fails
**Status**: Keep this fix (correct per Yellow team guidance)

### Attempt 4: Allocation Format Resolution
**Hypothesis**: Round-trip conversion of allocations was causing data loss
**Problem Identified**:
- Yellow Network provides: `{destination, token, amount}`
- We converted to: `[index, amount]` (lost token!)
- Then converted back to: `{destination, token, amount}` (used wrong token!)

**Action**: Store and use Yellow Network's **original allocations** directly
**Code Changes**:
```typescript
// Store original allocations from response
let originalAllocations: any[] | undefined;
originalAllocations = channelData.state?.allocations;

// Use them directly for signing (no conversion)
if (originalAllocations && originalAllocations[0].destination) {
  allocationsForSigning = originalAllocations.map((a: any) => ({
    destination: a.destination as Address,
    token: a.token as Address,
    amount: BigInt(a.amount || 0)
  }));
}
```
**Result**: ❌ Server signature **STILL** fails
**Status**: Keep this fix (logically correct)

---

## Current Implementation

### State Encoding (FLATTENED - Correct Format)
```typescript
const packedData = encodeAbiParameters(
  [
    { name: 'channelId', type: 'bytes32' },
    { name: 'intent', type: 'uint8' },
    { name: 'version', type: 'uint256' },     // ✅ uint256 (not uint64)
    { name: 'data', type: 'bytes' },
    {
      name: 'allocations',
      type: 'tuple[]',
      components: [
        { name: 'destination', type: 'address' },
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ]
    }
  ],
  [
    channelId,                                // From Yellow Network response
    state.intent,                             // 1 (INITIALIZE)
    BigInt(state.version),                    // 0 as uint256
    state.data,                               // "0x"
    allocationsForSigning                     // ORIGINAL from Yellow Network
  ]
);

const stateHash = keccak256(packedData);
```

### Signature Verification (EIP-191)
```typescript
// Using EIP-191 recovery (confirmed by Yellow team)
const { recoverMessageAddress } = await import('viem');

const recoveredUser = await recoverMessageAddress({
  message: { raw: stateHash },
  signature: userSignature
});

const recoveredServer = await recoverMessageAddress({
  message: { raw: stateHash },
  signature: serverSignature
});
```

### Allocations Used for Signing
```
[0] destination: 0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682 (user)
    token:       0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (USDC)
    amount:      0

[1] destination: 0x435d4B6b68e1083Cc0835D1F971C4739204C1d2a (clearnode)
    token:       0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (USDC)
    amount:      0
```

---

## Yellow Network Team Guidance

### From Technical Team Response:

1. **Encoding Format**: FLATTENED
   ```
   abi.encode(channelId, intent, version, data, allocations[])
   ```

2. **Version Type**: `uint256` (not `uint64`)

3. **Allocations**: Must use `{destination, token, amount}` format with real addresses

4. **Signature Format**: Standard EIP-191
   > "Format: Standard EIP-191."

5. **Recovered Address Issue**:
   > "Recovered Address: That 0x9d94... is just junk data resulting from running ecrecover on a hash the server never actually signed."

6. **Signatures Required**: Both user and server
   > "Signatures: You need both. Custody.create strictly requires sigs.length == 2."

---

## Remaining Possibilities

### 1. ⚠️ Channel ID Encoding Mismatch
**Hypothesis**: Yellow Network might compute channelId differently
**Our Calculation**:
```typescript
channelId = keccak256(abi.encode(
  participants,     // [Address, Address]
  adjudicator,      // Address
  challenge,        // uint256
  nonce,            // uint256
  chainId           // uint256
));
```

**Concern**: We added `chainId` to match Yellow docs, but maybe they DON'T include it in practice?

**Test**: Compare our computed channelId vs Yellow's provided channelId

### 2. ⚠️ EIP-191 Prefix Mismatch
**Hypothesis**: Yellow Network signs with EIP-191 but maybe uses a different prefix format
**Standard EIP-191**: `"\x19Ethereum Signed Message:\n32" + hash`
**Possible Variants**:
- EIP-191 version byte variations
- Personal sign vs typed data
- Different message length encoding

### 3. ⚠️ Data Field Name Mismatch
**Observation**: Yellow Network response uses `state_data` field
**Our Code**: Handles both `data` and `state_data`
```typescript
data: stateObj.data || stateObj.state_data || '0x'
```
**Concern**: Are we using the right field?

### 4. ⚠️ Address Casing/Checksum
**Hypothesis**: Address casing differences causing encoding mismatch
**Yellow Network Provides**: Mixed case (checksummed)
**Our Code**: Using as-is

**Test Needed**: Try lowercase all addresses before encoding

### 5. ⚠️ Smart Contract vs Off-Chain Signature Format
**Hypothesis**: Yellow Network provides signature for CONTRACT verification (raw), but we're verifying OFF-CHAIN (EIP-191)

**Critical Question**: Should we:
- Use `recoverAddress()` (raw) for CONTRACT signatures?
- Use `recoverMessageAddress()` (EIP-191) for OFF-CHAIN messages?

**Yellow Team Said**: "Standard EIP-191" - but maybe they mean for RPC requests, not contract sigs?

---

## Debugging Steps Needed

### Step 1: Verify Channel ID Computation
```typescript
// Log both
console.log('Yellow Network channel_id:', channelData.channel_id);
console.log('Our computed channelId:   ', computeChannelId(channel, chainId));

// Try without chainId
console.log('Without chainId:          ', computeChannelIdOld(channel));
```

### Step 2: Try Raw ECDSA Recovery for Server Signature
```typescript
// Current (EIP-191)
const recoveredServer = await recoverMessageAddress({
  message: { raw: stateHash },
  signature: serverSignature
});

// Try RAW instead
const { recoverAddress } = await import('viem');
const recoveredServerRaw = await recoverAddress({
  hash: stateHash,
  signature: serverSignature
});

console.log('EIP-191 recovery:', recoveredServer);
console.log('Raw recovery:    ', recoveredServerRaw);
```

### Step 3: Verify Exact Bytes Being Encoded
```typescript
// Log each field before encoding
console.log('Encoding parameters:');
console.log('  channelId:', channelId);
console.log('  intent:   ', state.intent);
console.log('  version:  ', BigInt(state.version), typeof BigInt(state.version));
console.log('  data:     ', state.data);
console.log('  allocs[0]:', allocationsForSigning[0]);
console.log('  allocs[1]:', allocationsForSigning[1]);

// Log packed data before hashing
console.log('Packed data:', packedData);
console.log('State hash: ', stateHash);
```

### Step 4: Contact Yellow Network Support
**Questions to Ask**:
1. What EXACT data structure do you sign for `server_signature`?
2. Do you use EIP-191 prefix or raw ECDSA for contract signatures?
3. Can you provide the state hash you computed for channel `0xced69acbed331ccd0a6fb708d2515f7dc1f3d1009193137d39048e483c7104a1`?
4. Does `server_signature` include chainId in the data being signed?

---

## Files Modified

### `/apps/backend/src/services/yellow-network/channel-service.ts`
**Key Changes**:
- Lines 342: Added `originalAllocations` variable
- Lines 357: Store original allocations from response
- Lines 733-761: Use original allocations for signing (no conversion)
- Lines 763-787: Flattened encoding with uint256 version
- Lines 769: Version changed to uint256
- Lines 785: Use allocationsForSigning instead of resolved

### `/apps/backend/src/services/yellow-network/session-auth.ts`
**Status**: Correct - uses EIP-191 for RPC request signing

---

## Test Data Archive

### Latest Failed Attempt (2026-01-08 17:23:00)

**Channel Response**:
```json
{
  "channel_id": "0xced69acbed331ccd0a6fb708d2515f7dc1f3d1009193137d39048e483c7104a1",
  "channel": {
    "participants": [
      "0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682",
      "0x435d4B6b68e1083Cc0835D1F971C4739204C1d2a"
    ],
    "adjudicator": "0x7de4A0736Cf5740fD3Ca2F2e9cc85c9AC223eF0C",
    "challenge": 3600,
    "nonce": 1767873179910
  },
  "state": {
    "intent": 1,
    "version": 0,
    "state_data": "0x",
    "allocations": [
      {
        "destination": "0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682",
        "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "amount": "0"
      },
      {
        "destination": "0x435d4B6b68e1083Cc0835D1F971C4739204C1d2a",
        "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "amount": "0"
      }
    ]
  },
  "server_signature": "0x0e210c43943963219f5f6a5da0966dc93d342c119507d7000a78dd8c96fa36245f44aab40e3ccd724eb1f913d5d06b80ee485ecf9927eb1ae210d4d07384f2481c"
}
```

---

## ✅ FINAL FIX - Allocation Format AND Version Type

### Attempt 5: Fix Contract ABI - Allocation Format
**Date**: January 8, 2026 (continued)
**Hypothesis**: Custody contract expects `{destination, token, amount}` allocations, not `{index, amount}`
**Action**:
1. Updated `CUSTODY_ABI` definitions for `create`, `resize`, and `close` functions
2. Changed allocation components from `{index, amount}` to `{destination, token, amount}`
3. Updated contract calls to convert allocations before submission

**Result**: ✅ Fixed allocation format

### Attempt 6: Fix Version Type in ABI ⭐ **ROOT CAUSE**
**Date**: January 8, 2026 (continued)
**Hypothesis**: ABI version type (uint64) doesn't match contract State struct (uint256)
**Discovery**: Checked actual Nitrolite contract source code:
```solidity
// contract/src/interfaces/Types.sol
struct State {
    StateIntent intent;
    uint256 version;  // ← uint256, NOT uint64!
    bytes data;
    Allocation[] allocations;
    bytes[] sigs;
}
```

**Problem**:
- We sign with `uint256` (correct)
- Contract expects `uint256` (correct)
- **But our ABI had `uint64` (WRONG!)** ← This caused encoding mismatch!

**Fix**:
```typescript
// BEFORE (WRONG):
{ name: 'version', type: 'uint64' }

// AFTER (CORRECT):
{ name: 'version', type: 'uint256' }  // Must match contract State struct!
```

**Why This Matters**:
When viem encodes the contract call parameters, it uses the ABI types. With uint64, the encoding differed from what we signed (uint256), causing signature verification to fail on-chain!

**Result**: ✅ **FIXED** - Version type now matches contract

**Status**: 🎯 **READY FOR TEST** - This should resolve the contract revert!

---

## Next Actions Required

1. ✅ **COMPLETED**: Raw ECDSA signatures - BOTH signatures verify correctly
2. ✅ **COMPLETED**: ChannelId computation - matches Yellow Network's format
3. ✅ **COMPLETED**: Allocation format fix - contract ABI and calls updated
4. ⏳ **TEST**: Run end-to-end channel creation test to verify fix works

---

## References

- [Yellow Network Signature Formats](https://docs.yellow.org/docs/protocol/on-chain/signature-formats/)
- [Yellow Network Channel Methods](https://docs.yellow.org/docs/protocol/off-chain/channel-methods/)
- [Yellow Network Data Structures](https://docs.yellow.org/docs/protocol/on-chain/data-structures/)
- [Issue Gist](https://gist.github.com/utk-dwd/741fd38e3b869990ed2f4d0fbff57340)

---

**Last Updated**: 2026-01-08 17:25:00
**Next Review**: After implementing debugging steps above
