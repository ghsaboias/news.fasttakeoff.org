// Quick script to send newsletter test email
import { readFileSync } from 'fs';

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.argv[2];
const newsletterHTML = readFileSync('./NEWSLETTER.html', 'utf-8');

if (!RESEND_API_KEY) {
  console.error('Error: RESEND_API_KEY not found');
  console.error('Usage: RESEND_API_KEY=your_key node send-newsletter-test.js');
  console.error('   or: node send-newsletter-test.js your_key');
  process.exit(1);
}

const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'Fast Takeoff News <newsletter@news.fasttakeoff.org>',
    to: ['gsaboia@yahoo.com'],
    subject: 'Fast Takeoff News - September 28 - October 5, 2025',
    html: newsletterHTML,
  }),
});

const data = await response.json();

if (response.ok) {
  console.log('✅ Newsletter sent successfully!');
  console.log('Email ID:', data.id);
} else {
  console.error('❌ Failed to send newsletter');
  console.error('Error:', data);
}
