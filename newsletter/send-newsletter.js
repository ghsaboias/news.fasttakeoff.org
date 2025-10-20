#!/usr/bin/env node
/**
 * Send newsletter to all active subscribers with personalized unsubscribe tokens
 *
 * Usage:
 *   RESEND_API_KEY=xxx node send-newsletter.js NEWSLETTER_191025.html "Subject Line"
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

// Configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DB_PATH = process.env.DB_PATH || '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/7bc73994101f430ebd4f7149d23808bb.sqlite';
const FROM_EMAIL = 'Fast Takeoff News <newsletter@news.fasttakeoff.org>';

// Parse command line arguments
const [,, htmlFile, subject] = process.argv;

if (!htmlFile || !subject) {
  console.error('Usage: RESEND_API_KEY=xxx node send-newsletter.js <html-file> <subject>');
  console.error('Example: RESEND_API_KEY=xxx node send-newsletter.js NEWSLETTER_191025.html "Fast Takeoff News - Oct 19-25"');
  process.exit(1);
}

if (!RESEND_API_KEY) {
  console.error('Error: RESEND_API_KEY environment variable not set');
  process.exit(1);
}

// Read newsletter HTML template
let newsletterTemplate;
try {
  newsletterTemplate = readFileSync(htmlFile, 'utf-8');
} catch (error) {
  console.error(`Error reading ${htmlFile}:`, error.message);
  process.exit(1);
}

// Get active subscribers from D1 database
console.log('📊 Fetching active subscribers from database...');
const db = new Database(DB_PATH);
const subscribers = db.prepare(`
  SELECT email, verification_token
  FROM newsletter_subscriptions
  WHERE status = 'active'
`).all();

console.log(`Found ${subscribers.length} active subscribers\n`);

if (subscribers.length === 0) {
  console.log('No active subscribers found. Exiting.');
  process.exit(0);
}

// Send to each subscriber with personalized unsubscribe link
let successCount = 0;
let failCount = 0;

for (const subscriber of subscribers) {
  const { email, verification_token } = subscriber;

  // Replace {{UNSUBSCRIBE_TOKEN}} with subscriber's unique token
  const personalizedHTML = newsletterTemplate.replace(
    /\{\{UNSUBSCRIBE_TOKEN\}\}/g,
    verification_token
  );

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: subject,
        html: personalizedHTML,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ Sent to ${email} (ID: ${data.id})`);
      successCount++;
    } else {
      console.error(`❌ Failed to send to ${email}:`, data);
      failCount++;
    }

    // Rate limiting: wait 100ms between emails to avoid hitting Resend limits
    await new Promise(resolve => setTimeout(resolve, 100));

  } catch (error) {
    console.error(`❌ Error sending to ${email}:`, error.message);
    failCount++;
  }
}

db.close();

// Summary
console.log('\n' + '='.repeat(50));
console.log('📧 Newsletter Send Summary');
console.log('='.repeat(50));
console.log(`✅ Successful: ${successCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`📊 Total: ${subscribers.length}`);
console.log('='.repeat(50));
