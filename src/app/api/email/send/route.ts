import { NextResponse } from 'next/server';

// Email sending temporarily disabled during migration to Resend

export async function POST() {
  return NextResponse.json(
    { 
      error: 'Email sending temporarily disabled',
      message: 'Email service is being migrated to Resend. Please use the newsletter subscription endpoint instead.'
    },
    { status: 503 }
  );
}

// Health check endpoint
export async function GET() {
  return NextResponse.json(
    { 
      status: 'Email service available',
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  );
}