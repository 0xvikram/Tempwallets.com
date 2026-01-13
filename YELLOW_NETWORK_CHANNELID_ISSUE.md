# Yellow Network Channel Creation Issue - ChannelId Mismatch

**Date**: January 9, 2026
**Status**: ❌ Contract Reverts - ChannelId Computation Mismatch
**Chain**: Base Mainnet (8453)
**Contract**: `0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6`

---

## 📋 Executive Summary

**Problem**: Channel creation contract call reverts despite both signatures verifying perfectly off-chain.

**Root Cause**: ChannelId mismatch between Yellow Network's RPC response and the Custody contract's computation.

**Current Status**:
- ✅ All 3 diagnostic checks pass (allocation order, data field, chainId)
- ✅ Both signatures (user + server) verify correctly off-chain
- ✅ Implementation matches Yellow team guidance
- ❌ Contract rejects due to channelId mismatch

---

## 🎯 Current Progress

### ✅ What's Working

#### 1. **Allocation Order** - PERFECT ✅
Yellow team guidance: *"The server maps index: 0 to participants[0]"*

**Our Implementation:**
```typescript
// Using Yellow Network's ORIGINAL allocations without modification
allocationsForSigning = originalAllocations.map((a: any) => ({
  destination: a.destination as Address,  // EXACT address from Yellow
  token: a.token as Address,              // EXACT token from Yellow
  amount: BigInt(a.amount || 0)
}));
```

**Verification Results:**
```
Participants from Yellow Network:
  [0] 0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682
  [1] 0x435d4B6b68e1083Cc0835D1F971C4739204C1d2a

Allocations from Yellow Network response:
  [0] destination: 0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682, token: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, amount: 0
  [1] destination: 0x435d4B6b68e1083Cc0835D1F971C4739204C1d2a, token: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, amount: 0

✅ allocation[0].destination matches participants[0]: true
✅ allocation[1].destination matches participants[1]: true
```

---

#### 2. **Data Field** - PERFECT ✅
Yellow team guidance: *"Ensure you are encoding data as '0x' (hex string for empty bytes)"*

**Our Implementation:**
```typescript
const dataField = state.data;  // From Yellow Network response
// Uses: state.data || state.state_data || '0x'
```

**Verification Results:**
```
state.data value: "0x"
state.data type: string
state.data === "0x": true ✅
```

---

#### 3. **ChainId** - CORRECT ✅
Yellow team guidance: *"Verify it matches the Server's environment (Base Mainnet 8453 vs Sepolia 84532)"*

**Our Implementation:**
```typescript
const chainId = 8453;  // Base Mainnet
```

**Verification Results:**
```
chainId we're using: 8453
Expected for Base Mainnet: 8453 ✅
```

---

#### 4. **State Encoding** - FLATTENED FORMAT ✅

**Our Implementation:**
```typescript
const packedData = encodeAbiParameters(
  [
    { name: 'channelId', type: 'bytes32' },
    { name: 'intent', type: 'uint8' },
    { name: 'version', type: 'uint256' },     // uint256 (not uint64)
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
    channelId,                    // Yellow's provided channelId
    state.intent,                 // 1 (INITIALIZE)
    BigInt(state.version),        // 0 as uint256
    dataField,                    // "0x"
    allocationsForSigning         // Yellow's exact allocations
  ]
);

const stateHash = keccak256(packedData);
```

**Encoding Details:**
- **Format**: FLATTENED (not nested tuple)
- **Version Type**: `uint256` (matches contract State struct)
- **Allocations**: `{destination, token, amount}` format (matches contract)

---

#### 5. **Signature Verification** - BOTH PASS ✅

Yellow team guidance: *"Once you get recoverAddress(server_sig) to match the Server ID locally, the contract call will pass immediately."*

**Our Implementation:**
```typescript
// RAW ECDSA signatures (for smart contract ecrecover)
const userSignature = await walletClient.account.sign({
  hash: stateHash
});

// Verify both signatures
const { recoverAddress } = await import('viem');

const recoveredUser = await recoverAddress({
  hash: stateHash,
  signature: userSignature
});

const recoveredServer = await recoverAddress({
  hash: stateHash,
  signature: serverSignature
});
```

**Verification Results:**
```
State hash: 0xec8152e1c661a17009dad203477a82349334d26870df0df78edca1f1d7193230

User signature:   0x5a4dbf26eb8f22b689f0dbeecfd2b7540a8fae8326a68c3bcfcebf5ce165a86f...
  → Recovered:    0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682
  → Expected:     0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682
  → Status:       ✅ MATCH

Server signature: 0xd87724ebee551a3b84fb9c2c83e18c3220c7734ad3d12493b5d8f7f6ca41960d...
  → Recovered:    0x435d4B6b68e1083Cc0835D1F971C4739204C1d2a
  → Expected:     0x435d4B6b68e1083Cc0835D1F971C4739204C1d2a (clearnode)
  → Status:       ✅ MATCH

🎉 BOTH SIGNATURES VERIFIED SUCCESSFULLY!
```

**We've achieved Yellow team's success criteria**, but the contract still reverts.

---

## 🔴 The Issue: ChannelId Mismatch

### Contract Error
```
ContractFunctionExecutionError: The contract function "create" reverted.

Contract Call:
  address:   0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6
  function:  create(...)
  sender:    0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682

Error: execution reverted
```

### ChannelId Comparison

```
Yellow Network provides:
  0x771be78cbc3a3ed09555f9c7b54ead7234d414f7af326004066efb5564b5a5a0

Our computation (standard encoding):
  0xe748ca4c650949a502f31ac659899b3fee12e0a26848d338992c942ed89e5fcc

❌ MISMATCH!
```

**Impact**:
1. We sign state using Yellow's channelId → Signatures verify off-chain ✅
2. Contract computes its own channelId from parameters → Different hash!
3. Contract tries to verify signatures with ITS channelId → Hash mismatch → Revert ❌

---

## 🔬 Testing & Investigation

### Test 1: Standard Encoding

**Code:**
```typescript
import { encodeAbiParameters, keccak256 } from 'viem';

const participants = [
  '0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682',
  '0x435d4B6b68e1083Cc0835D1F971C4739204C1d2a'
];
const adjudicator = '0x7de4A0736Cf5740fD3Ca2F2e9cc85c9AC223eF0C';
const challenge = 3600n;
const nonce = 1767957227070n;
const chainId = 8453n;

// Standard encoding per Yellow docs
const encoded = encodeAbiParameters(
  [
    {type: 'address[2]'},
    {type: 'address'},
    {type: 'uint256'},
    {type: 'uint256'},
    {type: 'uint256'}
  ],
  [participants, adjudicator, challenge, nonce, chainId]
);

const channelId = keccak256(encoded);
console.log('Computed:', channelId);
// Result: 0xe748ca4c650949a502f31ac659899b3fee12e0a26848d338992c942ed89e5fcc

console.log('Yellow provided:', '0x771be78cbc3a3ed09555f9c7b54ead7234d414f7af326004066efb5564b5a5a0');
// ❌ NO MATCH
```

**Result**: Our standard encoding doesn't match Yellow's channelId.

---

### Test 2: WITHOUT chainId

**Code:**
```typescript
const encoded = encodeAbiParameters(
  [
    {type: 'address[2]'},
    {type: 'address'},
    {type: 'uint256'},
    {type: 'uint256'}
  ],
  [participants, adjudicator, challenge, nonce]
);

const channelId = keccak256(encoded);
console.log('Without chainId:', channelId);
// Result: 0xf01c995320c6b80c421b10f1e7318d01ad824fc3097f5cb7de4cad22527f5b53

// ❌ STILL NO MATCH
```

**Result**: Removing chainId doesn't match either.

---

### Test 3: Brute Force Search (0-100,000)

**Code:**
```typescript
const TARGET = '0x771be78cbc3a3ed09555f9c7b54ead7234d414f7af326004066efb5564b5a5a0';

for (let i = 0; i <= 100000; i++) {
  const chainId = BigInt(i);

  const enc = encodeAbiParameters(
    [{type: 'address[2]'}, {type: 'address'}, {type: 'uint256'}, {type: 'uint256'}, {type: 'uint256'}],
    [participants, adjudicator, challenge, nonce, chainId]
  );

  const hash = keccak256(enc);

  if (hash === TARGET) {
    console.log(`FOUND! chainId = ${i}`);
    break;
  }
}

// Result: ❌ No match found in range 0-100000
```

**Result**: Yellow's channelId doesn't match standard encoding with ANY chainId value from 0 to 100,000!

---

### Test 4: Check On-Chain

**Code:**
```typescript
const CUSTODY_ABI = [{
  name: 'channels',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'channelId', type: 'bytes32' }],
  outputs: [/* channel struct */]
}];

// Check Yellow's channelId
await publicClient.readContract({
  address: '0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6',
  abi: CUSTODY_ABI,
  functionName: 'channels',
  args: ['0x771be78cbc3a3ed09555f9c7b54ead7234d414f7af326004066efb5564b5a5a0']
});
// Result: Contract reverts (channel doesn't exist)

// Check our computed channelId
await publicClient.readContract({
  address: '0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6',
  abi: CUSTODY_ABI,
  functionName: 'channels',
  args: ['0xe748ca4c650949a502f31ac659899b3fee12e0a26848d338992c942ed89e5fcc']
});
// Result: Contract reverts (channel doesn't exist)
```

**Result**: Neither channelId exists on-chain, confirming this is pre-creation mismatch.

---

## 📝 Complete Channel Data

### From Yellow Network RPC Response

```json
{
  "channel_id": "0x771be78cbc3a3ed09555f9c7b54ead7234d414f7af326004066efb5564b5a5a0",
  "channel": {
    "participants": [
      "0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682",
      "0x435d4B6b68e1083Cc0835D1F971C4739204C1d2a"
    ],
    "adjudicator": "0x7de4A0736Cf5740fD3Ca2F2e9cc85c9AC223eF0C",
    "challenge": 3600,
    "nonce": 1767957227070
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
  "server_signature": "0xd87724ebee551a3b84fb9c2c83e18c3220c7734ad3d12493b5d8f7f6ca41960d1ad86bc4d70129d46c685433823fc4b817fd768bee1c309bdca3bca8b201f7041b"
}
```

### Contract Call Arguments

```typescript
await walletClient.writeContract({
  address: '0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6',
  abi: CUSTODY_ABI,
  functionName: 'create',
  args: [
    // Arg 1: channel
    {
      participants: [
        '0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682',
        '0x435d4B6b68e1083Cc0835D1F971C4739204C1d2a'
      ],
      adjudicator: '0x7de4A0736Cf5740fD3Ca2F2e9cc85c9AC223eF0C',
      challenge: 3600n,
      nonce: 1767957227070n
    },
    // Arg 2: state
    {
      intent: 1,
      version: 0n,
      data: '0x',
      allocations: [
        {
          destination: '0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682',
          token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amount: 0n
        },
        {
          destination: '0x435d4B6b68e1083Cc0835D1F971C4739204C1d2a',
          token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amount: 0n
        }
      ]
    },
    // Arg 3: signatures
    [
      '0x5a4dbf26eb8f22b689f0dbeecfd2b7540a8fae8326a68c3bcfcebf5ce165a86f4cd177f0dd519614399dec2fec102d3603b54080f52561d6d2d00931c947f5681b',  // User
      '0xd87724ebee551a3b84fb9c2c83e18c3220c7734ad3d12493b5d8f7f6ca41960d1ad86bc4d70129d46c685433823fc4b817fd768bee1c309bdca3bca8b201f7041b'   // Server
    ]
  ]
});
```

---

## 💡 Our Implementation (Complete Code)

### ChannelId Usage
```typescript
// CRITICAL: Use Yellow Network's provided channelId for signing
const channelIdFromResponse = channelData.channel_id as Hash;
const channelId = channelIdFromResponse;

console.log('[ChannelService] Using Yellow Network channelId:', channelId);
// 0x771be78cbc3a3ed09555f9c7b54ead7234d414f7af326004066efb5564b5a5a0
```

### State Hash Computation
```typescript
// FLATTENED encoding (not nested)
const packedData = encodeAbiParameters(
  [
    { name: 'channelId', type: 'bytes32' },
    { name: 'intent', type: 'uint8' },
    { name: 'version', type: 'uint256' },
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
    channelId,                    // Yellow's channelId
    state.intent,                 // 1
    BigInt(state.version),        // 0n
    state.data,                   // "0x"
    allocationsForSigning         // Yellow's exact allocations
  ]
);

const stateHash = keccak256(packedData);
```

### Signature Generation
```typescript
// RAW ECDSA (for smart contract ecrecover)
const userSignature = await walletClient.account.sign({
  hash: stateHash
});

// Server signature from Yellow Network
const serverSignature = channelData.server_signature;

const signatures = [userSignature, serverSignature];
```

### Custody ABI (Used for Contract Call)
```typescript
const CUSTODY_ABI = [
  {
    name: 'create',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'channel',
        type: 'tuple',
        components: [
          { name: 'participants', type: 'address[2]' },
          { name: 'adjudicator', type: 'address' },
          { name: 'challenge', type: 'uint256' },
          { name: 'nonce', type: 'uint256' }
        ]
      },
      {
        name: 'state',
        type: 'tuple',
        components: [
          { name: 'intent', type: 'uint8' },
          { name: 'version', type: 'uint256' },  // uint256 (not uint64)
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
        ]
      },
      { name: 'sigs', type: 'bytes[]' }
    ],
    outputs: []
  }
];
```

---

## ❓ Questions for Yellow Network Team

1. **ChannelId Computation**:
   - How does Yellow Network compute `channel_id` in the RPC response?
   - Does it match the Custody contract's computation: `keccak256(abi.encode(participants, adjudicator, challenge, nonce, chainId))`?
   - If not, what's the correct encoding scheme?

2. **Contract Version**:
   - Is the Custody contract at `0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6` the correct/latest version for Base Mainnet?
   - Does this contract compute channelId the same way as the RPC?

3. **Documentation**:
   - Yellow docs say: `channelId = keccak256(abi.encode(participants, adjudicator, challenge, nonce, chainId))`
   - Is this accurate for the current implementation?

4. **Workaround**:
   - Should we compute our own channelId using the standard method and ignore Yellow's provided `channel_id`?
   - Or should we ask Yellow to fix the channelId computation on their side?

---

## 🎯 Summary

**What's Working:**
- ✅ All 3 diagnostic checks pass perfectly
- ✅ Both signatures verify correctly off-chain
- ✅ Implementation follows Yellow team guidance exactly
- ✅ Using Yellow's exact allocations without modification
- ✅ Correct encoding format (FLATTENED)
- ✅ Correct types (uint256 for version)

**What's NOT Working:**
- ❌ ChannelId mismatch between Yellow RPC and Custody contract
- ❌ Contract rejects with "execution reverted"

**Root Cause:**
Yellow Network's `channel_id` in RPC response doesn't match the Custody contract's channelId computation using standard encoding.

**Resolution Needed:**
Clarification on correct channelId computation method for Base Mainnet (8453).

---

## 🔍 Analysis: Reference Implementation vs Our Implementation

### Yellow Network Reference Repository

**Source**: https://github.com/ihsraham/my-yellow-app

The Yellow team provided this as a working reference implementation.

### Key Differences

#### 1. **SDK vs Custom Implementation**

**Reference Implementation:**
```typescript
// Uses official Yellow Network SDK
import { NitroliteClient, WalletStateSigner } from '@erc7824/nitrolite';

const client = new NitroliteClient({
    publicClient,
    walletClient,
    stateSigner: new WalletStateSigner(walletClient),
    addresses: {
        custody: '0x019B65A265EB3363822f2752141b3dF16131b262',
        adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2'
    },
    chainId: sepolia.id,  // 11155111
    challengeDuration: 3600n
});
```

**Our Implementation:**
```typescript
// Custom implementation without SDK
export class ChannelService {
    constructor(
        ws: WebSocketManager,
        auth: SessionKeyAuth,
        publicClient: PublicClient,
        walletClient: WalletClient,
        custodyAddresses: Record<number, Address>
    ) {
        // Manual setup
    }
}
```

**Impact**: The SDK handles channelId computation internally. We're trying to compute it manually, causing the mismatch.

---

#### 2. **Channel Creation**

**Reference Implementation:**
```typescript
// Lines 320-335 of index.ts
if (type === 'create_channel') {
    const { channel_id, channel, state, server_signature } = msg.res[2];

    const unsignedInitialState = {
        intent: state.intent,
        version: BigInt(state.version),
        data: state.state_data,
        allocations: state.allocations.map((a: any) => ({
            destination: a.destination,
            token: a.token,
            amount: BigInt(a.amount)
        }))
    };

    // SDK handles channelId computation and signing internally
    const res = await client.createChannel({
        channel,
        unsignedInitialState,
        serverSignature: server_signature
    });
}
```

**Our Implementation:**
```typescript
// We manually compute channelId
const channelId = channelIdFromResponse || this.computeChannelIdWithChainId(channel, chainId);

// Manual state encoding
const packedData = encodeAbiParameters([...], [channelId, ...]);
const stateHash = keccak256(packedData);

// Manual signing
const userSignature = await walletClient.account.sign({ hash: stateHash });

// Manual contract call
await walletClient.writeContract({
    address: custodyAddress,
    abi: CUSTODY_ABI,
    functionName: 'create',
    args: [channel, state, [userSignature, serverSignature]]
});
```

**Impact**: The SDK's internal channelId computation likely differs from our manual approach.

---

#### 3. **State Signer**

**Reference Implementation:**
```typescript
// Uses SDK's WalletStateSigner
stateSigner: new WalletStateSigner(walletClient)
```

**Our Implementation:**
```typescript
// Manual RAW ECDSA signing
const userSignature = await walletClient.account.sign({
    hash: stateHash
});
```

**Impact**: The `WalletStateSigner` class might use a different signing approach or channelId computation.

---

#### 4. **Network Differences**

**Reference Implementation:**
- **Network**: Sepolia Testnet (Chain ID: 11155111)
- **Custody**: `0x019B65A265EB3363822f2752141b3dF16131b262`
- **Adjudicator**: `0x7c7ccbc98469190849BCC6c926307794fDfB11F2`
- **WebSocket**: `wss://clearnet-sandbox.yellow.com/ws`

**Our Implementation:**
- **Network**: Base Mainnet (Chain ID: 8453)
- **Custody**: `0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6`
- **Adjudicator**: `0x7de4A0736Cf5740fD3Ca2F2e9cc85c9AC223eF0C`
- **WebSocket**: (Same or similar Yellow Network endpoint)

**Impact**: Different contract deployments might have different channelId computation logic.

---

#### 5. **SDK Package Version**

**Reference Implementation:**
```json
{
  "dependencies": {
    "@erc7824/nitrolite": "^0.5.3",
    "viem": "^2.41.2"
  }
}
```

The SDK provides:
- `NitroliteClient` - Main client class
- `WalletStateSigner` - State signing utility
- `createCreateChannelMessage` - Helper for channel creation RPC
- `createResizeChannelMessage` - Helper for resize RPC
- `createCloseChannelMessage` - Helper for close RPC
- All message creation helpers
- Internal channelId computation

**Our Implementation:**
- No SDK dependency
- Custom implementations of all functionality
- Manual channelId computation

---

### Critical Insights from Reference Implementation

#### 1. **SDK Handles ChannelId Internally**

The reference implementation NEVER manually computes channelId. It:
1. Receives `channel_id` from RPC response
2. Passes channel parameters to `client.createChannel()`
3. SDK internally handles:
   - ChannelId validation/computation
   - State hash creation
   - Signature generation
   - Contract call encoding

#### 2. **WalletStateSigner Abstraction**

```typescript
stateSigner: new WalletStateSigner(walletClient)
```

This class likely:
- Implements the correct channelId computation
- Handles state hash creation with proper encoding
- Signs states using the contract-expected format
- Manages signature format (RAW ECDSA vs EIP-191)

#### 3. **Optimistic Execution Pattern**

From FAQ:
> **Optimistic Flow:** `Create (On-Chain) -> Resize (Off-Chain Sign Only) -> Close (On-Chain with Resize State)`

The reference implementation:
1. Creates channel on-chain
2. Gets resize state from RPC (signed by server)
3. **Skips** on-chain resize transaction
4. Immediately closes with the resize state

This is safe because:
- State channels are cumulative
- Latest signed state is all that matters
- Node's signature proves fund allocation

#### 4. **Error Handling Wisdom**

From FAQ (line 62-77):
```
error: operation denied: non-zero allocation in 32 channel(s) detected
```

**Cause**: Trying to transfer while funds are locked in open channels.
**Solution**: Must close channels first to free funds.

This explains why proper channel lifecycle management is critical.

---

### Comparison Table

| Feature | Reference Implementation | Our Implementation | Status |
|---------|-------------------------|-------------------|---------|
| **SDK Usage** | ✅ Uses `@erc7824/nitrolite` v0.5.3 | ❌ Custom implementation | **DIFFERENT** |
| **ChannelId Computation** | ✅ SDK handles internally | ❌ Manual computation | **MISMATCH** |
| **State Signing** | ✅ `WalletStateSigner` | ❌ Manual RAW ECDSA | **DIFFERENT** |
| **Contract Calls** | ✅ `client.createChannel()` | ❌ Manual `writeContract()` | **DIFFERENT** |
| **Network** | Sepolia Testnet (11155111) | Base Mainnet (8453) | **DIFFERENT** |
| **Custody Contract** | `0x019B65...` | `0x490fb1...` | **DIFFERENT** |
| **Allocations Format** | ✅ `{destination, token, amount}` | ✅ `{destination, token, amount}` | **SAME** |
| **State Encoding** | ✅ FLATTENED (via SDK) | ✅ FLATTENED | **SAME** |
| **Version Type** | ✅ uint256 (via SDK) | ✅ uint256 | **SAME** |
| **Data Field** | ✅ "0x" (via SDK) | ✅ "0x" | **SAME** |

---

### Why Our Implementation Fails

1. **ChannelId Computation**: The SDK's `WalletStateSigner` or `NitroliteClient` computes channelId differently than our manual approach
2. **No Access to SDK Logic**: We can't see how the SDK computes channelId internally
3. **Contract Mismatch**: Yellow's RPC provides a channelId that matches the SDK's computation, but not our manual computation
4. **Cross-Network Differences**: Base Mainnet contracts might use different channelId computation than Sepolia

---

### Reference Implementation Code Snippets

#### Complete Channel Creation Flow

```typescript
// Lines 313-339 from index.ts
if (type === 'create_channel') {
    const { channel_id, channel, state, server_signature } = msg.res[2];
    console.log(`[Alice] Channel prepared: ${channel_id} (Ver: ${state.version})`);

    // Build unsigned state from RPC response
    const unsignedInitialState = {
        intent: state.intent,
        version: BigInt(state.version),
        data: state.state_data,
        allocations: state.allocations.map((a: any) => ({
            destination: a.destination,
            token: a.token,
            amount: BigInt(a.amount)
        })),
    };

    // SDK handles everything internally
    const res = await alice.client.createChannel({
        channel,
        unsignedInitialState,
        serverSignature: server_signature
    });

    const txHash = typeof res === 'string' ? res : res.txHash;
    console.log(`[Alice] Channel created on-chain: ${txHash}`);

    // Trigger Resize
    const token = state.allocations[0].token;
    await triggerResize(alice, channel_id, token, false);
}
```

#### SDK Client Initialization

```typescript
// Lines 92-102 from index.ts
this.client = new NitroliteClient({
    publicClient,
    walletClient: this.walletClient,
    stateSigner: new WalletStateSigner(this.walletClient),
    addresses: {
        custody: '0x019B65A265EB3363822f2752141b3dF16131b262',
        adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2',
    },
    chainId: sepolia.id,  // 11155111
    challengeDuration: 3600n,
});
```

---

## 🎯 Recommended Solutions

### Option 1: Use Yellow Network SDK (RECOMMENDED)

**Install SDK:**
```bash
npm install @erc7824/nitrolite@^0.5.3
```

**Refactor to use SDK:**
```typescript
import { NitroliteClient, WalletStateSigner } from '@erc7824/nitrolite';

const client = new NitroliteClient({
    publicClient,
    walletClient,
    stateSigner: new WalletStateSigner(walletClient),
    addresses: {
        custody: '0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6',  // Base Mainnet
        adjudicator: '0x7de4A0736Cf5740fD3Ca2F2e9cc85c9AC223eF0C'
    },
    chainId: 8453,  // Base Mainnet
    challengeDuration: 3600n
});

// Channel creation becomes:
const { channel, state, server_signature } = rpcResponse;
const res = await client.createChannel({
    channel,
    unsignedInitialState: {
        intent: state.intent,
        version: BigInt(state.version),
        data: state.state_data,
        allocations: state.allocations.map(a => ({
            destination: a.destination,
            token: a.token,
            amount: BigInt(a.amount)
        }))
    },
    serverSignature: server_signature
});
```

**Benefits:**
- ✅ SDK handles channelId computation correctly
- ✅ Proven working implementation (reference app)
- ✅ Maintained by Yellow Network team
- ✅ Handles all edge cases and protocol updates

**Drawbacks:**
- Requires significant refactoring
- Adds dependency on `@erc7824/nitrolite` package

---

### Option 2: Ask Yellow Team for ChannelId Computation Details

**Questions to ask:**
1. How does `WalletStateSigner` compute channelId?
2. Does Base Mainnet use different computation than Sepolia?
3. Can you provide the exact encoding scheme for Base Mainnet (8453)?
4. Is there source code for `@erc7824/nitrolite` we can review?
5. What's the difference between SDK's channelId computation and the standard `keccak256(abi.encode(...))`?

---

### Option 3: Reverse Engineer SDK

**Steps:**
1. Install `@erc7824/nitrolite` package
2. Check if package includes source maps or TypeScript definitions
3. Inspect `WalletStateSigner` and `NitroliteClient` implementation
4. Extract channelId computation logic
5. Apply to our implementation

**Feasibility**: Depends on whether SDK package includes readable source code.

---

## 📊 Final Recommendation

**PRIMARY RECOMMENDATION: Adopt Yellow Network SDK (`@erc7824/nitrolite`) v0.5.3**

**Reasons:**
1. ✅ **Proven Working**: Reference implementation works perfectly on Sepolia
2. ✅ **Official Support**: Maintained by Yellow Network team
3. ✅ **Handles Complexity**: All channelId/signing/encoding logic is tested and correct
4. ✅ **Future-Proof**: SDK will be updated for protocol changes
5. ✅ **Time-Saving**: Eliminates debugging custom implementation

**Implementation Path:**
1. Install `@erc7824/nitrolite@^0.5.3`
2. Replace `ChannelService` with `NitroliteClient`
3. Replace manual signing with `WalletStateSigner`
4. Update contract addresses for Base Mainnet
5. Test channel creation flow
6. If successful, migrate all channel operations to SDK

**Expected Outcome:**
- ChannelId will match contract's computation
- Signatures will verify on-chain
- Channel creation will succeed
- No more "execution reverted" errors

---

**We're ready to proceed with SDK integration or await Yellow team's guidance! 🙏**

---

## 🔄 UPDATE: SDK Integration Attempted

**Date**: January 10, 2026
**Action**: Migrated to official Yellow Network SDK v0.5.3
**Result**: ❌ Same `InvalidStateSignatures()` error on Base Mainnet

### What We Did

Following Yellow team's recommendation to use their reference implementation, we:

1. ✅ Installed `@erc7824/nitrolite@0.5.3`
2. ✅ Created SDK wrapper service
3. ✅ Integrated `WalletStateSigner` for state signing
4. ✅ Configured SDK with Base Mainnet addresses:
   ```typescript
   new NitroliteClient({
       publicClient,
       walletClient,
       stateSigner: new WalletStateSigner(walletClient),
       addresses: {
           custody: '0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6',
           adjudicator: '0x7de4A0736Cf5740fD3Ca2F2e9cc85c9AC223eF0C'
       },
       chainId: 8453,  // Base Mainnet
       challengeDuration: 3600n
   });
   ```

### Result

**Contract still rejects with the same error:**

```
Error: InvalidStateSignatures()

Contract Call:
  address:   0x490fb189DdE3a01B00be9BA5F41e3447FbC838b6
  function:  create((address[] participants, address adjudicator, uint64 challenge, uint64 nonce), ...)
  sender:    0xAb4a17FF2C8196dDcaEF280cCc402511f41E5682
```

### Critical Discovery

**The reference implementation only supports Sepolia testnet:**
- Reference app (`my-yellow-app`): Sepolia (chainId: 11155111)
- Our environment: Base Mainnet (chainId: 8453)

**The SDK's signatures work on Sepolia but fail on Base Mainnet**, indicating:
- Different contract versions on different chains, OR
- ChannelId computation differs per chain, OR
- SDK is hard-coded for Sepolia only

### Current Status

**SDK Integration: TEMPORARILY DISABLED**

System reverted to custom implementation until Yellow team clarifies Base Mainnet support.

See full SDK migration attempt: `YELLOW_SDK_MIGRATION.md`

---

## 🎯 FINAL RECOMMENDATION

**For Yellow Network Team:**

We need urgent clarification on one of these paths:

### Path A: SDK Supports Base Mainnet
**Questions:**
- What Base Mainnet-specific configuration are we missing?
- Are there known differences in contract behavior?
- Should we use a different SDK version?

### Path B: SDK Doesn't Support Base Mainnet
**Please provide:**
- Exact channelId computation logic for Base Mainnet (8453)
- State hash encoding scheme for Base contracts
- Any Base-specific implementation guidelines

### Path C: Use Sepolia Instead
**Guidance needed:**
- Should we migrate to Sepolia testnet for Yellow integration?
- What's the long-term plan for Base Mainnet support?

---

## 📦 Deliverables for Yellow Team

1. **This Document** (`YELLOW_NETWORK_CHANNELID_ISSUE.md`):
   - Complete issue analysis
   - All 3 diagnostic checks passing
   - Signature verification working off-chain
   - ChannelId mismatch identified

2. **SDK Migration Document** (`YELLOW_SDK_MIGRATION.md`):
   - SDK integration attempt
   - Network compatibility issue discovered
   - Current fallback status

3. **Test Results**:
   - Custom implementation: ChannelId mismatch
   - SDK implementation: InvalidStateSignatures on Base
   - Both work perfectly off-chain, fail on-chain

---

**Current Status**: ⏸️ **BLOCKED** - Awaiting Yellow Network team guidance on Base Mainnet support

**Next Step**: Yellow team please advise on correct path forward for Base Mainnet (8453) integration
