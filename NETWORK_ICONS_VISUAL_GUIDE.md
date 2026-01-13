# Visual Example of Network Icons in Send Module

## Before Implementation
```
┌─────────────────────────────────────┐
│ Token                               │
├─────────────────────────────────────┤
│ Select token                        ▼│
└─────────────────────────────────────┘

Dropdown:
┌─────────────────────────────────────┐
│ ETH - 1.234567                      │
│ USDC - 100.50                       │
│ MATIC - 500.0                       │
│ ARB - 25.123456                     │
└─────────────────────────────────────┘
```

## After Implementation
```
┌─────────────────────────────────────┐
│ Token                               │
├─────────────────────────────────────┤
│ [ETH] ETH - 1.234567                ▼│
└─────────────────────────────────────┘

Dropdown:
┌─────────────────────────────────────┐
│ [ETH] ETH - 1.234567                │
│ [ETH] USDC - 100.50                 │
│ [MATIC] MATIC - 500.0              │
│ [ARB] ARB - 25.123456              │
└─────────────────────────────────────┘
```

Where:
- [ETH] = Ethereum network icon
- [MATIC] = Polygon network icon
- [ARB] = Arbitrum network icon

## Component Structure

### SelectedTokenDisplay (Trigger)
```tsx
<div className="flex items-center gap-2">
  <NetworkIcon className="h-4 w-4 flex-shrink-0" />
  <span>
    {token.symbol} - {formatBalance(token.balance, token.decimals)}
  </span>
</div>
```

### TokenSelectItem (Dropdown Options)
```tsx
<SelectItem value={value} className="...">
  <div className="flex items-center gap-2">
    <NetworkIcon className="h-4 w-4 flex-shrink-0" />
    <span className="flex-1">
      {token.symbol} - {formatBalance(token.balance, token.decimals)}
    </span>
  </div>
</SelectItem>
```

## Layout Properties

### Icon Specifications
- Size: `h-4 w-4` (16x16 pixels)
- Flex: `flex-shrink-0` (prevents icon from shrinking)
- Spacing: `gap-2` (8px between icon and text)

### Text Layout
- Display: `flex items-center` (vertical centering)
- Text span: `flex-1` in dropdown items (takes remaining space)

## Supported Network Icons

The system automatically displays icons for:

| Network | Icon Source |
|---------|-------------|
| Ethereum | @thirdweb-dev/chain-icons/ethereum |
| Bitcoin | @thirdweb-dev/chain-icons/bitcoin |
| Polygon | @thirdweb-dev/chain-icons/polygon |
| Arbitrum | @thirdweb-dev/chain-icons/arbitrum |
| Base | @thirdweb-dev/chain-icons/ethereum (fallback) |
| Optimism | @thirdweb-dev/chain-icons/optimism |
| Avalanche | @thirdweb-dev/chain-icons/avalanche |
| Solana | @thirdweb-dev/chain-icons/solana |
| Polkadot | @thirdweb-dev/chain-icons/polkadot-new |
| Tron | @thirdweb-dev/chain-icons/tron |
| Other chains | Polkadot icon (fallback) |

## Benefits

1. **Visual Recognition**: Users can quickly identify tokens by their network icon
2. **Multi-Network Support**: Easy to distinguish same tokens across different networks (e.g., USDC on Ethereum vs USDC on Polygon)
3. **Consistent Design**: Icons maintain consistent 16x16px size across all networks
4. **Accessible**: Maintains proper spacing and alignment for readability
5. **Responsive**: Icons adapt to the component's styling and theme
