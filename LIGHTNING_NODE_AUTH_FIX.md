# Lightning Node Authentication Fix

## Issue Summary
The Lightning Node was failing to create channels with an "authentication required" error from Yellow Network, even though the session key authentication appeared to be working for read operations (querying sessions and channels).

## Root Cause
The session key authentication was using an incomplete `scope` parameter that didn't include permissions for channel operations.

**Previous scope:**
```typescript
scope = 'transfer,app.create,app.submit'
```

This scope only allowed:
- `transfer` - Transfer operations
- `app.create` - Create app sessions
- `app.submit` - Submit app operations

But **did NOT include channel operations**, which caused the `create_channel` request to fail with "authentication required".

## The Fix

### Files Modified

#### 1. `/apps/backend/src/services/yellow-network/nitrolite-client.ts`
Updated the authentication call to include full channel operation permissions:

```typescript
await this.auth.authenticate({
  application: this.config.application,
  allowances: [], // Empty = unrestricted session (Yellow Network requirement)
  expiryHours: 24,
  scope: 'transfer,app.create,app.submit,channel.create,channel.update,channel.close', // Include all channel operations
});
```

#### 2. `/apps/backend/src/services/yellow-network/session-auth.ts`
Updated the default scope to be more comprehensive:

```typescript
const {
  allowances = [],
  application = 'tempwallets-lightning',
  expiryHours = 24,
  scope = 'transfer,app.create,app.submit,channel.create,channel.update,channel.close',
} = options || {};
```

### New Scope Permissions

The updated scope now includes:
- ✅ `transfer` - Transfer operations
- ✅ `app.create` - Create app sessions
- ✅ `app.submit` - Submit app operations
- ✅ `channel.create` - **Create payment channels** (NEW)
- ✅ `channel.update` - **Update channel state (resize_channel)** (NEW)
- ✅ `channel.close` - **Close channels** (NEW)

## Why This Fixes the Issue

1. **Authentication Flow**: The session key authentication was completing successfully, as evidenced by the ability to query sessions and channels
2. **Permission Check**: When attempting to create a channel, Yellow Network's clearnode checks if the session key has the required `channel.create` permission
3. **Previous Failure**: Without `channel.create` in the scope, the request was rejected with "authentication required"
4. **Now Fixed**: With the complete scope, the session key has all necessary permissions for channel operations

## Testing

To verify the fix works:

1. **Start the application**:
   ```bash
   cd /Users/monstu/Developer/Tempwallets.com
   turbo run dev
   ```

2. **Test channel creation**:
   - Navigate to the Lightning Node interface
   - Click "Fund Channel"
   - The channel should now be created successfully without authentication errors

## Expected Log Output

Before fix:
```
[ChannelService] ✅ Session key authenticated
[SessionKeyAuth] Signing request...
[ChannelService] Full response: {
  "res": [10, "error", {"error": "authentication required"}, ...]
}
❌ Yellow Network error: {"error":"authentication required"}
```

After fix:
```
[ChannelService] ✅ Session key authenticated
[SessionKeyAuth] Signing request...
[ChannelService] Full response: {
  "res": [10, "create_channel", { "channel_id": "0x...", ...}, ...]
}
✅ Channel created successfully
```

## Related Components

- **SessionKeyAuth**: Manages session key authentication and request signing
- **NitroliteClient**: High-level client for Yellow Network interactions
- **ChannelService**: Handles payment channel operations
- **LightningNodeService**: Orchestrates Lightning Node functionality

## Additional Notes

- The session key authentication uses EIP-712 typed data signatures for the initial authentication
- Once authenticated, all subsequent requests are signed with the session key (not the main wallet)
- Sessions expire after 24 hours by default
- Empty `allowances` array means unrestricted session (required by Yellow Network for payment channels)

## Verification Checklist

- [x] Updated nitrolite-client.ts with full scope
- [x] Updated session-auth.ts default scope
- [x] No compilation errors
- [ ] Test channel creation in development
- [ ] Test channel resizing (funding)
- [ ] Test channel closing
- [ ] Verify session expiration handling
