import { TIME } from '@/lib/config';
import { NextResponse } from 'next/server';

// Simple API route to handle 410 Gone responses for expired content
export async function GET() {
    return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
    <title>410 - Content Expired</title>
    <meta name="robots" content="noindex, nofollow">
</head>
<body>
    <h1>410 - Content Expired</h1>
    <p>This news report has expired and is no longer available.</p>
    <p>News content on this site is only available for 30 days.</p>
    <a href="/current-events">View Current News</a>
</body>
</html>`,
        {
            status: 410,
            statusText: 'Gone',
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': `public, max-age=${TIME.DAY_SEC}`,
            }
        }
    );
}
