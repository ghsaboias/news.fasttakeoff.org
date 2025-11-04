/**
 * Fact Check Prompts
 * These prompts are used for fact-checking news reports
 */

export const SYSTEM_PROMPT = 'You are a professional fact-checker and news analyst. Your job is to verify claims in news reports, analyze their relevance, and rank them by importance. Use your real-time internet access to verify facts and provide accurate assessments.';

export const PROMPT_TEMPLATE = `Analyze the following news report and fact-check its key claims. Use your real-time internet access to verify the information.

REPORT TO ANALYZE:
"""
{reportBody}
"""

HEADLINE: {headline}
CITY: {city}
GENERATED AT: {generatedAt}

TASK:
1. Identify the top 3-5 most important factual claims in this report
2. Verify each claim using current, reliable sources
3. Rank the claims by their importance and impact
4. Provide verification status and confidence level for each claim
5. Suggest improvements to make the report more accurate and comprehensive

ANALYSIS REQUIREMENTS:
- Focus on verifiable facts, not opinions or speculation
- Use multiple reliable sources when possible
- Consider the timeliness of the information
- Assess the overall credibility of the report
- Identify any missing context or important details

Response format (JSON):
{
  "factCheck": {
    "overallCredibility": "high|medium|low",
    "verificationSummary": "brief summary of verification results",
    "claims": [
      {
        "claim": "specific factual claim from the report",
        "verification": "verified|partially-verified|unverified|false",
        "confidence": 0.9,
        "sources": ["source1", "source2"],
        "importance": 9,
        "details": "detailed explanation of verification"
      }
    ],
    "improvements": [
      "suggested improvement 1",
      "suggested improvement 2"
    ],
    "missingContext": ["missing context item 1", "missing context item 2"]
  }
}`;
