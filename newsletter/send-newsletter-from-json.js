#!/usr/bin/env node
/**
 * Send newsletter to subscribers from JSON file with personalized unsubscribe tokens
 *
 * Usage:
 *   1. Export subscribers from D1:
 *      npx wrangler d1 execute FAST_TAKEOFF_NEWS_DB --remote \
 *        --command "SELECT email, verification_token FROM newsletter_subscriptions WHERE status = 'active'" \
 *        --json > subscribers.json
 *
 *   2. Send newsletter:
 *      RESEND_API_KEY=xxx node send-newsletter-from-json.js subscribers.json NEWSLETTER.html "Subject"
 */

import { readFileSync } from 'fs';

// Configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'Fast Takeoff News <newsletter@news.fasttakeoff.org>';

// Parse command line arguments
const [,, subscribersFile, htmlFile, subject] = process.argv;

if (!subscribersFile || !htmlFile || !subject) {
  console.error('Usage: RESEND_API_KEY=xxx node send-newsletter-from-json.js <subscribers-json> <html-file> <subject>');
  console.error('');
  console.error('Example:');
  console.error('  Step 1 - Export subscribers from remote D1:');
  console.error('    npx wrangler d1 execute FAST_TAKEOFF_NEWS_DB --remote \\');
  console.error('      --command "SELECT email, verification_token FROM newsletter_subscriptions WHERE status = \'active\'" \\');
  console.error('      --json > subscribers.json');
  console.error('');
  console.error('  Step 2 - Send newsletter:');
  console.error('    RESEND_API_KEY=xxx node send-newsletter-from-json.js subscribers.json NEWSLETTER.html "Subject Line"');
  process.exit(1);
}

if (!RESEND_API_KEY) {
  console.error('Error: RESEND_API_KEY environment variable not set');
  process.exit(1);
}

// Read subscribers JSON
let subscribersData;
try {
  const rawData = readFileSync(subscribersFile, 'utf-8');
  subscribersData = JSON.parse(rawData);
} catch (error) {
  console.error(`Error reading ${subscribersFile}:`, error.message);
  process.exit(1);
}

// Extract subscribers array from wrangler JSON output format
// Wrangler returns: [{ "results": [...], "success": true, "meta": {...} }]
let subscribers;
if (Array.isArray(subscribersData) && subscribersData[0]?.results) {
  // Wrangler --json format
  subscribers = subscribersData[0].results;
} else if (Array.isArray(subscribersData)) {
  // Plain array format
  subscribers = subscribersData;
} else {
  console.error('Error: Invalid JSON format. Expected array of subscribers.');
  process.exit(1);
}

console.log(`📊 Loaded ${subscribers.length} subscribers from ${subscribersFile}`);

if (subscribers.length === 0) {
  console.log('No subscribers found. Exiting.');
  process.exit(0);
}

// Validate subscriber data
const invalidSubscribers = subscribers.filter(s => !s.email || !s.verification_token);
if (invalidSubscribers.length > 0) {
  console.error(`Error: ${invalidSubscribers.length} subscribers missing email or verification_token`);
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

// Check if template has unsubscribe token placeholder
if (!newsletterTemplate.includes('{{UNSUBSCRIBE_TOKEN}}')) {
  console.warn('⚠️  Warning: Newsletter template does not contain {{UNSUBSCRIBE_TOKEN}} placeholder');
  console.warn('    Unsubscribe links will not be personalized!');
}

console.log(`📧 Sending "${subject}" to ${subscribers.length} subscribers...\n`);

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

// Summary
console.log('\n' + '='.repeat(50));
console.log('📧 Newsletter Send Summary');
console.log('='.repeat(50));
console.log(`✅ Successful: ${successCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`📊 Total: ${subscribers.length}`);
console.log('='.repeat(50));
