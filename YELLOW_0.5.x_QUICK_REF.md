# Quick Reference: Yellow Network 0.5.x Changes

## TL;DR

1. ❌ **`amount` parameter removed** from `create_channel`
2. ✅ **`allocate_amount` parameter added** to `resize_channel`
3. 🔄 **Two-step flow**: Create with zero → Resize to fund

## API Changes at a Glance

### create_channel

```diff
- // OLD (0.3.x)
- create_channel({ chain_id: 137, token: "0x...", amount: "1000" })

+ // NEW (0.5.x)
+ create_channel({ chain_id: 137, token: "0x..." })
+ // Returns: channel with ZERO allocations (always)
```

### resize_channel

```diff
  // OLD (0.3.x)
  resize_channel({
    channel_id: "0x...",
    resize_amount: "1000",
    funds_destination: "0x..."
  })

+ // NEW (0.5.x)
  resize_channel({
    channel_id: "0x...",
    resize_amount: "1000",
+   allocate_amount: "-1000",  // NEW! Must be negative of resize_amount
    funds_destination: "0x..."
  })
```

## The Golden Rule

```
resize_amount = -allocate_amount
```

**Examples**:
- Deposit 1000 to channel: `resize_amount: 1000`, `allocate_amount: -1000`
- Withdraw 500 from channel: `resize_amount: -500`, `allocate_amount: 500`

## Why These Changes?

**Yellow Network Quote**:
> "Clearnode no longer supports creating channels with an initial deposit. All channels must be created with zero balance and funded separately through a resize operation."

## What Broke & Why

### Your Error: "invalid signature"

**Cause**: Missing `allocate_amount` parameter in resize request

**Before (broken)**:
```typescript
{
  channel_id: "0x...",
  resize_amount: "1000",
  funds_destination: "0x..."
  // Missing allocate_amount!
}
```

**After (fixed)**:
```typescript
{
  channel_id: "0x...",
  resize_amount: "1000",
  allocate_amount: "-1000",  // ✅ Added
  funds_destination: "0x..."
}
```

## Files You Modified

- `apps/backend/src/services/yellow-network/channel-service.ts`

## Testing Commands

```bash
# Start the dev server
turbo run dev

# Watch for these logs:
# ✅ "Creating channel with zero balance (0.5.x protocol)"
# ✅ "Yellow Network 0.5.x resize parameters"
# ✅ "Funds added to unified balance via resize_channel"
```

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "invalid signature" | Missing `allocate_amount` | Add `allocate_amount: -resize_amount` |
| Zero allocations | Expected in 0.5.x | This is normal! Use resize to fund |
| "operation denied: non-zero allocation" | Channel has funds | Resize to zero or close/recreate |

## Migration Status

- [x] Code updated
- [ ] Testing complete
- [ ] Production deployed

---

**Protocol Version**: Yellow Network 0.5.x  
**Last Updated**: January 7, 2026
