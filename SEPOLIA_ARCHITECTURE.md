# Sepolia Lightning Node Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Frontend UI                             │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Create  │  │  Deposit │  │ Transfer │  │  Close   │      │
│  │   Node   │  │  Funds   │  │  Funds   │  │   Node   │      │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘      │
│        │             │              │             │            │
└────────┼─────────────┼──────────────┼─────────────┼────────────┘
         │             │              │             │
         ▼             ▼              ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API (NestJS)                        │
│                                                                  │
│  POST /lightning-node/create                                    │
│  POST /lightning-node/fund-channel                              │
│  POST /lightning-node/transfer                                  │
│  POST /lightning-node/close                                     │
│  GET  /lightning-node/:id/balances                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Lightning Node Service                            │  │
│  │                                                           │  │
│  │  - Chain Validation (base, arbitrum, sepolia)           │  │
│  │  - Wallet Management (EOA signing)                      │  │
│  │  - NitroliteClient Initialization                       │  │
│  │  - Database Operations (Prisma)                         │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                     │                                           │
└─────────────────────┼───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NitroliteClient                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SDK Mode Detection                                       │  │
│  │  ┌────────────────────────────────────────────┐          │  │
│  │  │  if (chainId === 11155111) // Sepolia     │          │  │
│  │  │    useSDK = true  ✅                       │          │  │
│  │  │  else if (chainId === 8453) // Base       │          │  │
│  │  │    useSDK = false ❌                       │          │  │
│  │  └────────────────────────────────────────────┘          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                     │                                           │
│         ┌───────────┴───────────┐                              │
│         ▼                       ▼                              │
│  ┌─────────────────┐    ┌─────────────────┐                   │
│  │  SDK Channel    │    │  Custom Channel │                   │
│  │  Service        │    │  Service        │                   │
│  │  (Sepolia ✅)   │    │  (Base ⚠️)      │                   │
│  │                 │    │                 │                   │
│  │ - WalletState   │    │ - Manual        │                   │
│  │   Signer        │    │   channelId     │                   │
│  │ - SDK channelId │    │   computation   │                   │
│  │   computation   │    │ - Custom state  │                   │
│  │ - Proven to work│    │   signing       │                   │
│  └────────┬────────┘    └────────┬────────┘                   │
│           │                      │                             │
└───────────┼──────────────────────┼─────────────────────────────┘
            │                      │
            └──────────┬───────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│            Yellow Network ClearNode                              │
│            wss://clearnet.yellow.com/ws                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Authentication Flow                                      │  │
│  │  1. auth_request (with wallet address)                   │  │
│  │  2. auth_challenge (from ClearNode)                      │  │
│  │  3. auth_verify (signed with EIP-712)                    │  │
│  │  4. auth_success (JWT token)                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  RPC Methods                                              │  │
│  │  - get_config (contract addresses)                       │  │
│  │  - create_channel                                        │  │
│  │  - resize_channel (deposit/withdraw)                     │  │
│  │  - create_app_session (Lightning Node)                   │  │
│  │  - close_app_session                                     │  │
│  │  - get_ledger_balances                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Sepolia Testnet (Chain ID: 11155111)               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Smart Contracts (from get_config)                       │  │
│  │                                                           │  │
│  │  Custody Contract:                                       │  │
│  │  0x019B65A265EB3363822f2752141b3dF16131b262               │  │
│  │                                                           │  │
│  │  Adjudicator Contract:                                   │  │
│  │  0x7de4A0736Cf5740fD3Ca2F2e9cc85c9AC223eF0C               │  │
│  │                                                           │  │
│  │  Operations:                                             │  │
│  │  - createChannel() ✅                                     │  │
│  │  - resizeChannel() ✅                                     │  │
│  │  - closeChannel() ✅                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  RPC Node                                                 │  │
│  │  https://rpc.sepolia.org                                  │  │
│  │                                                           │  │
│  │  - Read blockchain state                                 │  │
│  │  - Submit transactions                                    │  │
│  │  - Verify signatures                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Transaction Flow Examples

### 1. Create Lightning Node (Off-Chain)

```
User → Backend
  ↓
Backend → NitroliteClient (chainId: 11155111)
  ↓
SDK Enabled ✅
  ↓
NitroliteClient → Yellow Network ClearNode
  {
    method: "create_app_session",
    participants: ["0x123...", "0x456..."],
    token: "usdc"
  }
  ↓
Yellow Network → SDK Channel Service
  - Computes channelId (correct for Sepolia)
  - Creates state with SDK's WalletStateSigner
  - Signs with user's EOA wallet
  ↓
Yellow Network → Sepolia Custody Contract
  custody.createChannel(channel, state, [userSig, serverSig])
  ↓
✅ Success
  ↓
Backend → Database (store Lightning Node)
  ↓
Backend → User (return Lightning Node details)
```

---

### 2. Gasless Transfer (Off-Chain Only!)

```
User → Backend
  {
    lightningNodeId: "ln_123...",
    to: "0x456...",
    amount: "5.0"
  }
  ↓
Backend → NitroliteClient
  ↓
NitroliteClient → Yellow Network ClearNode
  {
    method: "update_state",
    app_session_id: "0xabc...",
    allocations: [
      { participant: "0x123...", amount: "5.0" },
      { participant: "0x456...", amount: "5.0" }
    ]
  }
  ↓
Yellow Network (Off-Chain State Update)
  - Both parties sign new state
  - No blockchain transaction
  - Instant settlement
  - Zero gas fees
  ↓
✅ Balances Updated
  ↓
Backend → Database (record transaction)
  ↓
Backend → User (confirm transfer)
```

**Time**: < 1 second  
**Cost**: $0 (no gas fees!)  
**Finality**: Instant

---

### 3. Close Lightning Node (On-Chain Settlement)

```
User → Backend
  {
    lightningNodeId: "ln_123...",
    userId: "user_123"
  }
  ↓
Backend → NitroliteClient
  ↓
NitroliteClient → Yellow Network ClearNode
  {
    method: "close_app_session",
    app_session_id: "0xabc...",
    final_allocations: [...]
  }
  ↓
Yellow Network → SDK Channel Service
  - Creates final state
  - Both parties sign
  ↓
SDK → Sepolia Custody Contract
  custody.closeChannel(finalState, signatures)
  ↓
Sepolia Blockchain
  - Verifies signatures
  - Transfers funds to participants
  - Emits ChannelClosed event
  ↓
✅ Funds Withdrawn to Wallets
  ↓
Backend → Database (update status to "closed")
  ↓
Backend → User (return txHash + final balances)
```

**Time**: ~15 seconds (Sepolia block time)  
**Cost**: ~$0.01 worth of Sepolia ETH (testnet)  
**Finality**: On-chain settlement

---

## Data Flow

### Database Schema

```
┌─────────────────────┐
│   LightningNode     │
├─────────────────────┤
│ id                  │ (Primary Key)
│ userId              │ (Foreign Key → User)
│ appSessionId        │ (Yellow Network session ID)
│ uri                 │
│ chain               │ ("sepolia", "base", etc.)
│ token               │ ("usdc", "eth", etc.)
│ status              │ ("open", "closed")
│ maxParticipants     │
│ quorum              │
│ protocol            │
│ challenge           │
│ sessionData         │
│ createdAt           │
│ updatedAt           │
└─────────────────────┘
         │
         │ One-to-Many
         ▼
┌─────────────────────┐
│    Participant      │
├─────────────────────┤
│ id                  │
│ lightningNodeId     │ (FK)
│ address             │
│ weight              │
│ balance             │
│ asset               │
│ status              │ ("invited", "joined")
│ joinedAt            │
│ lastSeenAt          │
└─────────────────────┘
         │
         │ One-to-Many
         ▼
┌─────────────────────┐
│   Transaction       │
├─────────────────────┤
│ id                  │
│ lightningNodeId     │ (FK)
│ from                │
│ to                  │
│ amount              │
│ asset               │
│ type                │ ("deposit", "transfer", "withdraw")
│ status              │ ("pending", "completed", "failed")
│ txHash              │ (nullable, only for on-chain)
│ timestamp           │
└─────────────────────┘
```

---

## Configuration Matrix

### Supported Networks

| Network | Chain ID | SDK Status | Support | Notes |
|---------|----------|------------|---------|-------|
| **Sepolia** | 11155111 | ✅ Enabled | Full | Testnet, all features work |
| **Base** | 8453 | ❌ Disabled | Partial | ChannelId issues |
| **Arbitrum** | 42161 | ❌ Disabled | Untested | Should work like Base |
| **Polygon** | 137 | ❌ Disabled | Official | Yellow supports, needs testing |
| **Celo** | 42220 | ❌ Disabled | Official | Yellow supports, needs testing |

### Environment Variables

```bash
# Required
YELLOW_NETWORK_WS_URL=wss://clearnet.yellow.com/ws
DATABASE_URL=postgresql://...

# Optional (per-network)
SEPOLIA_RPC_URL=https://rpc.sepolia.org
BASE_RPC_URL=https://mainnet.base.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
```

---

## Security & Permissions

### Wallet Requirements

```
User Wallet (EOA)
  ├── Can sign EIP-712 messages ✅
  ├── Has Sepolia test ETH ✅
  ├── Has test USDC tokens ✅
  └── Private key secured ✅

NitroliteClient
  ├── Uses wallet for authentication ✅
  ├── Creates session keys ✅
  ├── Signs channel states ✅
  └── Never exposes private key ✅
```

### Authentication Flow

```
1. User provides wallet address
   ↓
2. Backend derives EOA signer from seed
   ↓
3. Sign EIP-712 challenge from Yellow Network
   ↓
4. Receive JWT token
   ↓
5. Use JWT for subsequent requests
   ↓
6. Session expires after 1 hour
   ↓
7. Auto-retry with re-authentication
```

---

## Performance Metrics

### Sepolia Testnet

| Operation | Time | Cost | On-Chain? |
|-----------|------|------|-----------|
| Create Node | ~3s | Free | Yes (channel creation) |
| Deposit | ~15s | ~$0.01 test ETH | Yes |
| Transfer | <1s | $0 | No ✅ |
| Balance Query | <500ms | $0 | No |
| Close Node | ~15s | ~$0.01 test ETH | Yes |

### Scalability

- **Off-Chain Transfers**: Unlimited throughput
- **Participants per Node**: Up to 50
- **Concurrent Nodes**: Limited by Yellow Network capacity
- **Gas Savings**: ~99% reduction (only deposit/withdraw on-chain)

---

## Error Handling

### Common Errors

```
Error: "Chain is required"
→ Fix: Include "chain": "sepolia" in request

Error: "No wallet address found"
→ Fix: Wallet auto-created, check user exists

Error: "YELLOW_NETWORK_WS_URL not configured"
→ Fix: Add to .env file

Error: "Session expired"
→ Fix: Auto-retry implemented, should resolve itself

Error: "InvalidStateSignatures()"
→ Fix: Only happens on Base, use Sepolia instead
```

---

**Status**: 🟢 **Production Ready** (for Sepolia testnet)

**Last Updated**: January 10, 2026
