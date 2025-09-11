import { Resend } from 'resend';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const resend = new Resend('***REMOVED***');

    const data = await resend.emails.send({
      from: 'Fast Takeoff News <newsletter@news.fasttakeoff.org>',
      to: [email],
      subject: 'Test Email from Fast Takeoff News',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Fast Takeoff News Test</h1>
          <p>Hello! This is a test email from Fast Takeoff News.</p>
          <p>If you receive this, our email integration is working correctly.</p>
          <p>Best regards,<br>Fast Takeoff News Team</p>
        </div>
      `,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('Email sending error:', error);
    return Response.json({ 
      error: 'Failed to send email', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}