'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader } from '@/components/ui/loader';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ProfilePage() {
    const { isLoaded, isSignedIn, user } = useUser();
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push('/sign-in');
        }
    }, [isLoaded, isSignedIn, router]);

    const handleSubscribe = async () => {
        setIsSubscribing(true);
        setError(null);
        console.log('Client-side user ID for checkout:', user?.id);
        try {
            const response = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?.id }),
            });
            if (!response.ok) throw new Error('Failed to initiate checkout');
            const { url } = await response.json() as { url: string };
            window.location.href = url;
        } catch (err) {
            setError('Failed to start subscription. Please try again.');
            console.error(err);
        } finally {
            setIsSubscribing(false);
        }
    };

    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader size="lg" />
            </div>
        );
    }

    if (!isSignedIn || !user) {
        return null; // Redirect handled by useEffect
    }

    const isSubscribed = user.publicMetadata?.subscribed === true;

    return (
        <div className="container mx-auto px-4 py-8 w-[95vw]">
            <Card className="max-w-md mx-auto">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">Your Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <p className="text-sm text-foreground">Email</p>
                        <p className="text-base">{user.primaryEmailAddress?.emailAddress}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-foreground">Name</p>
                        <p className="text-base">{user.fullName || 'Not set'}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-foreground">Subscription Status</p>
                        <p className="text-base">
                            {isSubscribed ? (
                                <span className="text-primary font-medium">Subscribed 🎉</span>
                            ) : (
                                <span className="text-foreground">Not subscribed</span>
                            )}
                        </p>
                    </div>
                    {!isSubscribed && (
                        <div className="pt-4">
                            <p className="text-sm text-foreground mb-2">
                                Join our premium plan for exclusive benefits at $2/month!
                            </p>
                            <Button
                                onClick={handleSubscribe}
                                disabled={isSubscribing}
                                className="w-full"
                            >
                                {isSubscribing ? (
                                    <Loader size="sm" className="mr-2" />
                                ) : (
                                    'Subscribe Now'
                                )}
                            </Button>
                            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}