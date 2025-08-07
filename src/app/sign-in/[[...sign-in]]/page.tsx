'use client';

import { SignIn } from '@clerk/nextjs';

export default function Page() {
    return (
        <div className="flex justify-center items-center min-h-screen bg-background">
            <div className="w-full max-w-md p-6">
                <SignIn />
            </div>
        </div>
    )
}