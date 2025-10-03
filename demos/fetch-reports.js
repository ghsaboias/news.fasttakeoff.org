#!/usr/bin/env node

/**
 * Quick script to fetch real reports from D1 and generate event data for time visualizations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function fetchReports() {
  console.log('🔄 Fetching last 100 reports from D1...');

  const query = `
    SELECT
      report_id,
      headline,
      body,
      channel_name,
      generated_at,
      message_count,
      window_start_time,
      window_end_time
    FROM reports
    WHERE generated_at >= datetime('now', '-72 hours')
    ORDER BY generated_at DESC
    LIMIT 100
  `;

  try {
    // Execute wrangler command
    const cmd = `npx wrangler d1 execute FAST_TAKEOFF_NEWS_DB --remote --command "${query.replace(/\n/g, ' ').trim()}"`;
    const output = execSync(cmd, { encoding: 'utf8' });

    // Parse the JSON - starts after the metadata lines
    const lines = output.split('\n');
    const jsonStartIndex = lines.findIndex(line => line.trim().startsWith('['));

    if (jsonStartIndex === -1) {
      throw new Error('No JSON data found in wrangler output');
    }

    const jsonLines = lines.slice(jsonStartIndex);
    const jsonString = jsonLines.join('\n');
    const data = JSON.parse(jsonString);
    const reports = data[0]?.results || [];

    console.log(`✅ Fetched ${reports.length} reports`);
    return reports;

  } catch (error) {
    console.error('❌ Failed to fetch reports:', error.message);
    return [];
  }
}

async function generateEventData(reports) {
  console.log('🧠 Generating event data from reports...');

  const events = [];

  reports.forEach((report, index) => {
    // Parse the generated_at time
    const eventTime = new Date(report.generated_at);
    const now = new Date();
    const ageMinutes = (now - eventTime) / (1000 * 60);

    // Extract key entities/events from headline using simple keyword extraction
    const headline = report.headline || '';
    const body = (report.body || '').substring(0, 200); // First 200 chars

    // Simple entity extraction (we'll make this smarter later)
    const entities = extractEntities(headline + ' ' + body);

    // Create events for each entity
    entities.forEach(entity => {
      events.push({
        id: `${report.report_id}_${entity.replace(/\s+/g, '_')}`,
        name: entity,
        type: classifyEntity(entity),
        reportId: report.report_id,
        headline: headline,
        channelName: report.channel_name,
        timestamp: eventTime.toISOString(),
        ageMinutes: ageMinutes,
        messageCount: report.message_count || 1,
        importance: calculateImportance(entity, headline, report.message_count || 1)
      });
    });
  });

  console.log(`🎯 Generated ${events.length} events from ${reports.length} reports`);
  return events;
}

function extractEntities(text) {
  // Simple extraction - look for capitalized words/phrases
  const entities = [];

  // Common geographic/political entities
  const patterns = [
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, // Capitalized words/phrases
    /\b(?:UKRAINE|RUSSIA|CHINA|TRUMP|BIDEN|NATO|EU|UN)\b/gi, // Key entities
    /\b[A-Z]{2,}\b/g // Acronyms
  ];

  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    entities.push(...matches);
  });

  // Filter and deduplicate
  const filtered = [...new Set(entities)]
    .filter(e => e.length > 2 && e.length < 20)
    .filter(e => !['THE', 'AND', 'FOR', 'WITH', 'AMID'].includes(e.toUpperCase()))
    .slice(0, 5); // Max 5 entities per report

  return filtered;
}

function classifyEntity(entity) {
  const upper = entity.toUpperCase();

  if (['UKRAINE', 'RUSSIA', 'CHINA', 'KOREA', 'IRAN', 'ISRAEL'].includes(upper)) return 'country';
  if (['TRUMP', 'BIDEN', 'PUTIN'].includes(upper)) return 'person';
  if (['NATO', 'EU', 'UN', 'ICE', 'DHS'].includes(upper)) return 'organization';
  if (upper.includes('ATTACK') || upper.includes('STRIKE') || upper.includes('EXPLOSION')) return 'event';
  if (upper.includes('MARKET') || upper.includes('INVESTMENT') || upper.includes('BILLION')) return 'economic';

  return 'general';
}

function calculateImportance(entity, headline, messageCount) {
  let importance = 0.5; // Base importance

  // Message count influence
  importance += Math.min(messageCount / 10, 0.3);

  // Entity type influence
  const type = classifyEntity(entity);
  if (type === 'country') importance += 0.2;
  if (type === 'person') importance += 0.15;
  if (type === 'event') importance += 0.25;

  // Headline position influence
  if (headline.toUpperCase().includes(entity.toUpperCase())) importance += 0.2;

  return Math.min(importance, 1.0);
}

function saveEventData(events) {
  const outputPath = path.join(__dirname, 'event-data.js');

  const jsContent = `
// Generated event data from real reports
// Generated at: ${new Date().toISOString()}

const EVENT_DATA = ${JSON.stringify(events, null, 2)};

// Helper functions for the visualization
function getEventsByAge(maxAgeMinutes = 1440) {
  return EVENT_DATA.filter(event => event.ageMinutes <= maxAgeMinutes);
}

function getEventsByType(type) {
  return EVENT_DATA.filter(event => event.type === type);
}

function getEventsByChannel(channelName) {
  return EVENT_DATA.filter(event => event.channelName === channelName);
}

// For browser use
if (typeof window !== 'undefined') {
  window.EVENT_DATA = EVENT_DATA;
  window.getEventsByAge = getEventsByAge;
  window.getEventsByType = getEventsByType;
  window.getEventsByChannel = getEventsByChannel;
}

// For Node.js use
if (typeof module !== 'undefined') {
  module.exports = { EVENT_DATA, getEventsByAge, getEventsByType, getEventsByChannel };
}
`;

  fs.writeFileSync(outputPath, jsContent);
  console.log(`💾 Saved ${events.length} events to: event-data.js`);
}

function generateStats(events) {
  console.log('\n📊 EVENT DATA STATS:');
  console.log(`Total events: ${events.length}`);

  const byType = {};
  const byChannel = {};
  const byAge = { '0-1h': 0, '1-6h': 0, '6-24h': 0, '24h+': 0 };

  events.forEach(event => {
    // By type
    byType[event.type] = (byType[event.type] || 0) + 1;

    // By channel
    byChannel[event.channelName] = (byChannel[event.channelName] || 0) + 1;

    // By age
    if (event.ageMinutes <= 60) byAge['0-1h']++;
    else if (event.ageMinutes <= 360) byAge['1-6h']++;
    else if (event.ageMinutes <= 1440) byAge['6-24h']++;
    else byAge['24h+']++;
  });

  console.log('\nBy Type:', byType);
  console.log('\nBy Age:', byAge);
  console.log('\nTop Channels:', Object.entries(byChannel)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => `${name}: ${count}`)
    .join(', ')
  );

  // Most important events
  const topEvents = events
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10);

  console.log('\nTop Events:');
  topEvents.forEach((event, i) => {
    console.log(`${i+1}. ${event.name} (${event.type}) - ${event.importance.toFixed(2)} - ${event.ageMinutes.toFixed(0)}min ago`);
  });
}

async function main() {
  console.log('🚀 Fetching real report data for time visualizations\n');

  const reports = await fetchReports();
  if (reports.length === 0) {
    console.log('❌ No reports fetched. Check your wrangler setup.');
    return;
  }

  const events = await generateEventData(reports);
  saveEventData(events);
  generateStats(events);

  console.log('\n✅ Ready! Now open time-rings.html or time-river.html');
  console.log('   The visualizations will load real event data automatically.');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fetchReports, generateEventData };