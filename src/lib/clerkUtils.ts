import { clerkClient } from '@clerk/nextjs/server';

export async function updateUserSubscription(userId: string) {
    console.log('CLERK_SECRET_KEY present:', !!process.env.CLERK_SECRET_KEY);
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, {
        publicMetadata: { subscribed: true },
    });
}