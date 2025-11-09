/**
 * Safely parse JSON from AI responses that may be wrapped in markdown code fences
 * Handles: ```json {...} ```, plain JSON, and markdown-wrapped JSON
 *
 * This utility is needed because AI models (especially Gemini via OpenRouter)
 * sometimes return JSON wrapped in markdown code fences despite response_format
 * being set to json_object or json_schema.
 */
export function parseAIJSON<T = unknown>(content: string): T {
  let jsonString = content.trim();

  // Strip markdown code fences if present
  if (jsonString.includes('```json')) {
    const jsonMatch = jsonString.match(/```json\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1];
    } else {
      // Fallback: remove all ```json and ``` markers
      jsonString = jsonString.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    }
  }

  return JSON.parse(jsonString) as T;
}