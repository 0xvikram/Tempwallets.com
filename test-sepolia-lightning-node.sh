#!/bin/bash

# Sepolia Testnet Testing Script
# This script helps you test Lightning Node functionality on Sepolia testnet

set -e

echo "🚀 Sepolia Testnet - Lightning Node Testing Script"
echo "=================================================="
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
USER_ID="${USER_ID:-test_user_$(date +%s)}"
CHAIN="sepolia"
TOKEN="usdc"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Configuration:${NC}"
echo "  API URL: $API_URL"
echo "  User ID: $USER_ID"
echo "  Chain: $CHAIN"
echo "  Token: $TOKEN"
echo ""

# Step 1: Create Lightning Node
echo -e "${YELLOW}Step 1: Creating Lightning Node on Sepolia...${NC}"
LIGHTNING_NODE_RESPONSE=$(curl -s -X POST "$API_URL/lightning-node/create" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"chain\": \"$CHAIN\",
    \"token\": \"$TOKEN\",
    \"participants\": [\"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\"],
    \"weights\": [100, 0],
    \"quorum\": 100,
    \"initialAllocations\": []
  }")

echo "$LIGHTNING_NODE_RESPONSE" | jq '.'

# Extract Lightning Node ID
LIGHTNING_NODE_ID=$(echo "$LIGHTNING_NODE_RESPONSE" | jq -r '.node.id // empty')

if [ -z "$LIGHTNING_NODE_ID" ]; then
  echo -e "${YELLOW}⚠️  Failed to create Lightning Node. Check if:${NC}"
  echo "  1. Backend server is running (turbo run dev)"
  echo "  2. YELLOW_NETWORK_WS_URL is configured"
  echo "  3. Database is accessible"
  exit 1
fi

echo -e "${GREEN}✅ Lightning Node created: $LIGHTNING_NODE_ID${NC}"
echo ""

# Step 2: Get Lightning Node Details
echo -e "${YELLOW}Step 2: Fetching Lightning Node details...${NC}"
curl -s "$API_URL/lightning-node/$LIGHTNING_NODE_ID" | jq '.'
echo ""

# Step 3: Get Balances
echo -e "${YELLOW}Step 3: Checking initial balances...${NC}"
curl -s "$API_URL/lightning-node/$LIGHTNING_NODE_ID/balances" | jq '.'
echo ""

# Step 4: Fund Channel
echo -e "${YELLOW}Step 4: Funding channel with 10.0 USDC...${NC}"
echo -e "${BLUE}Note: Make sure you have Sepolia test USDC in your wallet${NC}"
read -p "Press Enter to continue or Ctrl+C to skip..."

curl -s -X POST "$API_URL/lightning-node/fund-channel" \
  -H "Content-Type: application/json" \
  -d "{
    \"lightningNodeId\": \"$LIGHTNING_NODE_ID\",
    \"userId\": \"$USER_ID\",
    \"amount\": \"10.0\"
  }" | jq '.'
echo ""

# Step 5: Check Balances After Funding
echo -e "${YELLOW}Step 5: Checking balances after funding...${NC}"
curl -s "$API_URL/lightning-node/$LIGHTNING_NODE_ID/balances" | jq '.'
echo ""

# Step 6: Transfer Funds
echo -e "${YELLOW}Step 6: Transferring 5.0 USDC to participant...${NC}"
curl -s -X POST "$API_URL/lightning-node/transfer" \
  -H "Content-Type: application/json" \
  -d "{
    \"lightningNodeId\": \"$LIGHTNING_NODE_ID\",
    \"userId\": \"$USER_ID\",
    \"to\": \"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\",
    \"amount\": \"5.0\"
  }" | jq '.'
echo ""

# Step 7: Check Final Balances
echo -e "${YELLOW}Step 7: Checking final balances...${NC}"
curl -s "$API_URL/lightning-node/$LIGHTNING_NODE_ID/balances" | jq '.'
echo ""

# Step 8: Get Transaction History
echo -e "${YELLOW}Step 8: Fetching transaction history...${NC}"
curl -s "$API_URL/lightning-node/$LIGHTNING_NODE_ID/transactions" | jq '.'
echo ""

# Step 9: Close Lightning Node
echo -e "${YELLOW}Step 9: Closing Lightning Node...${NC}"
read -p "Press Enter to close the Lightning Node or Ctrl+C to keep it open..."

curl -s -X POST "$API_URL/lightning-node/close" \
  -H "Content-Type: application/json" \
  -d "{
    \"lightningNodeId\": \"$LIGHTNING_NODE_ID\",
    \"userId\": \"$USER_ID\"
  }" | jq '.'
echo ""

echo -e "${GREEN}✅ Test completed successfully!${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "  Lightning Node ID: $LIGHTNING_NODE_ID"
echo "  Chain: Sepolia Testnet"
echo "  Operations Tested: Create, Fund, Transfer, Balance Check, Close"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Check Sepolia Etherscan for on-chain transactions"
echo "  2. View logs in your backend terminal"
echo "  3. Test with multiple participants"
echo "  4. Integrate with your frontend UI"
echo ""
echo "🎉 Happy testing on Sepolia!"
