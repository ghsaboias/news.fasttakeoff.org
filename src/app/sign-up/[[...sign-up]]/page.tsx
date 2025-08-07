'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
    return (
        <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
            <div className="w-full p-12">
                <SignUp appearance={{
                    baseTheme: undefined,
                    variables: {
                        colorBackground: 'var(--muted)',
                        colorInputBackground: 'var(--background)',
                        colorInputText: 'var(--foreground)',
                        colorText: 'var(--foreground)',
                        fontSize: '16px',
                    }
                }} />
            </div>
        </div>
    );
} 