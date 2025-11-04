/**
 * Entity Extraction Prompts
 * These prompts are used for extracting named entities from news reports
 */

export const SYSTEM_PROMPT = 'You are an expert entity extraction system. Extract entities from news text with high precision. Respond in valid JSON format with entity types, values, positions, and confidence scores.';

export const PROMPT_TEMPLATE = `
Extract named entities from the following news text. Focus only on the most important entities for news intelligence and analysis.

ENTITY TYPES TO EXTRACT (ONLY THESE THREE):
- PERSON: Names of individuals (politicians, officials, public figures, leaders, etc.)
- ORGANIZATION: Companies, institutions, government agencies, political parties, military groups
- LOCATION: Countries, cities, states, regions, specific places, geographic areas

EXTRACTION REQUIREMENTS:
- Extract ONLY named entities that are specifically mentioned in the text
- Only extract entities that are central to the news story
- Provide confidence scores (0.0-1.0) based on contextual clarity
- Calculate relevance scores (0.0-1.0) based on importance to the story
- Include all mentions of each entity with precise text positions
- Normalize similar entities (e.g., "Trump" and "Donald Trump" as same PERSON)
- Do NOT extract generic terms, common nouns, or descriptive words
- Focus only on proper nouns that would be useful for news indexing and search

TEXT TO ANALYZE:
{text}

Extract entities and respond with the following JSON structure:
{
  "entities": [
    {
      "type": "PERSON|ORGANIZATION|LOCATION",
      "value": "normalized entity name",
      "mentions": [
        {
          "text": "exact text as it appears",
          "startIndex": number,
          "endIndex": number,
          "confidence": number
        }
      ],
      "relevanceScore": number,
      "category": "optional subcategory"
    }
  ]
}
`;
