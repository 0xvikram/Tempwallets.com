# 🚀 Quick Start: Lightning Node on Sepolia Testnet

Get started with Yellow Network Lightning Nodes on Sepolia testnet in 5 minutes!

---

## ✅ Prerequisites

- [x] Backend server running (`turbo run dev`)
- [x] Sepolia test ETH in your wallet (get from [faucet](https://sepoliafaucet.com/))
- [x] Environment variables configured

---

## 🔧 Setup (One-Time)

### 1. Environment Variables

Add to your `.env` file:

```bash
# Yellow Network
YELLOW_NETWORK_WS_URL=wss://clearnet.yellow.com/ws

# Sepolia RPC (optional - uses public RPC by default)
SEPOLIA_RPC_URL=https://rpc.sepolia.org
```

### 2. Get Sepolia Test ETH

Visit: https://sepoliafaucet.com/

Request: **0.5 ETH** (enough for testing)

---

## 🎯 Quick Test

### Option 1: Automated Test Script

```bash
./test-sepolia-lightning-node.sh
```

This will:
1. Create a Lightning Node
2. Fund the channel
3. Transfer funds
4. Check balances
5. Close the channel

### Option 2: Manual Testing

**1. Create Lightning Node:**

```bash
curl -X POST http://localhost:3000/lightning-node/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user",
    "chain": "sepolia",
    "token": "usdc",
    "participants": ["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"]
  }'
```

**2. Fund Channel:**

```bash
curl -X POST http://localhost:3000/lightning-node/fund-channel \
  -H "Content-Type: application/json" \
  -d '{
    "lightningNodeId": "YOUR_LIGHTNING_NODE_ID",
    "userId": "test_user",
    "amount": "10.0"
  }'
```

**3. Transfer Funds:**

```bash
curl -X POST http://localhost:3000/lightning-node/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "lightningNodeId": "YOUR_LIGHTNING_NODE_ID",
    "userId": "test_user",
    "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "amount": "5.0"
  }'
```

**4. Check Balances:**

```bash
curl http://localhost:3000/lightning-node/YOUR_LIGHTNING_NODE_ID/balances
```

**5. Close Lightning Node:**

```bash
curl -X POST http://localhost:3000/lightning-node/close \
  -H "Content-Type: application/json" \
  -d '{
    "lightningNodeId": "YOUR_LIGHTNING_NODE_ID",
    "userId": "test_user"
  }'
```

---

## 📊 Expected Output

### Success Logs

```
[NitroliteClient] ✅ Using Yellow Network SDK (Sepolia testnet mode)
[SDKChannelService] Initializing Yellow Network SDK
[SDKChannelService] Chain ID: 11155111
[SDKChannelService] ✅ SDK initialized successfully
✅ App session created on Yellow Network: 0xabc123...
✅ Lightning Node created: ln_abc123...
```

### API Response

```json
{
  "ok": true,
  "node": {
    "id": "ln_abc123...",
    "appSessionId": "0xabc123...",
    "chain": "sepolia",
    "token": "usdc",
    "status": "open"
  }
}
```

---

## 🐛 Troubleshooting

### Issue: "YELLOW_NETWORK_WS_URL is not configured"

**Solution:** Add to `.env`:
```bash
YELLOW_NETWORK_WS_URL=wss://clearnet.yellow.com/ws
```

### Issue: "No wallet address found for chain sepolia"

**Solution:** The wallet system auto-creates addresses. If this persists:
1. Check database connectivity
2. Verify user exists
3. Check logs for detailed error

### Issue: "Chain is required"

**Solution:** Make sure to include `"chain": "sepolia"` in your request body.

### Issue: Custom SDK fallback message

**Expected:** You should see "✅ Using Yellow Network SDK (Sepolia testnet mode)"

**If you see:** "⚠️ Using custom implementation" - Check that:
1. Chain is "sepolia" (not "base")
2. ChainId is being passed to NitroliteClient
3. No TypeScript compilation errors

---

## 📚 Full Documentation

- **Implementation Guide**: `SEPOLIA_TESTNET_IMPLEMENTATION.md`
- **SDK Migration**: `YELLOW_SDK_MIGRATION.md`
- **ChannelId Issues**: `YELLOW_NETWORK_CHANNELID_ISSUE.md`

---

## 🎯 What You Can Do

| Operation | Endpoint | Gas Required? |
|-----------|----------|---------------|
| Create Lightning Node | `POST /lightning-node/create` | ❌ No (off-chain) |
| Fund Channel | `POST /lightning-node/fund-channel` | ✅ Yes (on-chain) |
| Transfer Funds | `POST /lightning-node/transfer` | ❌ No (off-chain) |
| Check Balances | `GET /lightning-node/:id/balances` | ❌ No (query) |
| Close Lightning Node | `POST /lightning-node/close` | ✅ Yes (on-chain) |

---

## 🔗 Useful Links

- **Sepolia Faucet**: https://sepoliafaucet.com/
- **Sepolia Explorer**: https://sepolia.etherscan.io/
- **Yellow Network Docs**: https://erc7824.org/
- **Yellow Network GitHub**: https://github.com/erc7824/

---

## ✅ Next Steps

1. ✅ Test all operations on Sepolia
2. ✅ Build frontend UI
3. ✅ Test with multiple users
4. ⏳ Contact Yellow Network about Base Mainnet
5. ⏳ Deploy to production when ready

---

**Status**: 🟢 Ready to test on Sepolia!

**Last Updated**: January 10, 2026
