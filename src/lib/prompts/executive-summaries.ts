/**
 * Executive Summaries Prompts
 * These prompts are used for creating executive summaries from news reports
 */

export const SYSTEM_PROMPT = 'You are an expert news analyst. Your job is to create a concise, factual executive summary in simple, readable Markdown, focusing on the most important events of the last 6 hours. Prioritize by importance/impact first, then recency as a secondary factor. Strongly prefer more recent developments when importance is similar. Within each section, order items by (1) importance, (2) newest-to-oldest when time can be inferred. Do not include any commentary or speculation. Only include events that are significant and newsworthy. Output must be valid Markdown.';

export const PROMPT_TEMPLATE = `Create a concise executive summary in Markdown of the following news reports, focusing on the most important events of the last 6 hours.

For each major topic or region, create a section with a Markdown heading (## Section Name) followed by bullet points summarizing the key developments.

Do not include any commentary, speculation, and NEVER include a title (like "Executive Summary", or "Executive Summary: Key Global Developments (Past 6 Hours)"). Only include events that are significant and newsworthy.

SELECTION AND ORDERING RULES (CRITICAL):
- Selection priority: choose developments with the highest long-term impact and strategic significance.
- Consider both immediate effects and broader geopolitical implications when assessing importance.
- If two items are similarly important, prefer the more recent one.
- For ongoing stories, emphasize the newest information; include minimal earlier context only if essential to understand the update.
- Within each section, order bullet points by importance first; when importance is similar, order newest to oldest (e.g., using GENERATED_AT when available).

PREVIOUS EXECUTIVE SUMMARIES (if any):
{previousExecutiveSummaries}

REPORTS TO ANALYZE:
"""
{reportBody}
"""

Respond ONLY with valid Markdown using ## headings for each section, followed by bullet points summarizing the most important events of the last 6 hours.`;

export const MINI_PROMPT_TEMPLATE = `Given the following Executive Summary, write a much more compact version, preserving all key facts and events.
For each section in the summary, output a Markdown section heading (## Section Name) followed by a concise bullet point list of the most important facts/events from that section.
Do NOT include a top-level 'Executive Summary' heading or any introductory text.
Keep each section to a maximum of 3 bullet points, and the entire summary to 5 sections or fewer.
Use bold for key entities. Order bullets by long-term impact and strategic significance first, then recency (newest→oldest) when time can be inferred. When trimming, prioritize developments with broader geopolitical implications; if importance is similar, keep the more recent.

Executive Summary:
{executiveSummary}`;
