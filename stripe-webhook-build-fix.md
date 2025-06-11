# Stripe Webhook Build Fix

## Issue Summary

The deployment was failing during the Next.js build process with the error:
```
Error: Neither apiKey nor config.authenticator provided
    at r._setAuthenticator (.next/server/app/api/stripe/webhook/route.js:1:99854)
```

This occurred when Next.js tried to collect page data for `/api/stripe/webhook` during the build phase.

## Root Cause

The Stripe SDK was being initialized at module level in the webhook route:

```typescript
// ❌ PROBLEMATIC: Module-level initialization
const stripe = new Stripe(stripeSecretKey || '', {
    apiVersion: '2025-05-28.basil',
    httpClient: Stripe.createFetchHttpClient(),
});
```

Even though `stripeSecretKey` was an empty string during build time, the Stripe constructor was still being called, causing the SDK to try to set up authentication during the build process when environment variables may not be available.

## Solution Implemented

**File**: `src/app/api/stripe/webhook/route.ts`

### Before (Problematic)
```typescript
// Initialize Stripe with fetch-based client
const stripe = new Stripe(stripeSecretKey || '', {
    apiVersion: '2025-05-28.basil',
    httpClient: Stripe.createFetchHttpClient(),
});

export async function POST(req: Request) {
    // ... use stripe directly
}
```

### After (Fixed)
```typescript
// Helper to initialize Stripe only when needed
function getStripeInstance(): Stripe {
    if (!stripeSecretKey) {
        throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    return new Stripe(stripeSecretKey, {
        apiVersion: '2025-05-28.basil',
        httpClient: Stripe.createFetchHttpClient(),
    });
}

export async function POST(req: Request) {
    if (isBuildTime) {
        console.log('Skipping webhook handler during build time');
        return NextResponse.json({ received: true });
    }

    // Initialize Stripe only when actually processing the webhook
    const stripe = getStripeInstance();
    // ... rest of handler
}
```

## Key Changes

1. **Deferred Initialization**: Moved Stripe initialization from module level into the `POST` function
2. **Build-Time Protection**: Added early return for build-time execution
3. **Helper Function**: Created `getStripeInstance()` to encapsulate initialization logic
4. **Proper Error Handling**: Added validation before Stripe instantiation

## Benefits

- ✅ **Eliminates build-time errors** - No more SDK initialization during build
- ✅ **Maintains functionality** - Stripe still works correctly at runtime
- ✅ **Better error handling** - Clear error messages for missing environment variables
- ✅ **Performance improvement** - Stripe only initialized when needed
- ✅ **Build consistency** - Works reliably across different deployment environments

## Pattern for Other Services

This fix establishes a good pattern for any external service SDK initialization:

1. **Never initialize SDKs at module level** if they require API keys
2. **Use helper functions** to defer initialization until needed
3. **Add build-time guards** in API routes that use external services
4. **Validate environment variables** before SDK initialization

## Testing

The fix ensures that:
- ✅ Build process completes successfully
- ✅ Webhook functionality works at runtime
- ✅ Proper error handling for missing environment variables
- ✅ No impact on other API routes or functionality