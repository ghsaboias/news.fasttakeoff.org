/**
 * Entity Extraction and Graph Analysis Types
 * 
 * Types for named entity recognition, entity graph visualization,
 * and relationship mapping in news reports and content analysis.
 */

export interface EntityMention {
  text: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface Entity {
  type: 'person' | 'company' | 'fund';
  name: string;
  country: string;
  netWorth?: number; // in billions USD for persons
  marketCap?: number; // in trillions USD for companies
  aum?: number; // in trillions USD for funds
}

export interface ExtractedEntity {
  type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'EVENTS' | 'DATES' | 'FINANCIAL' | 'PRODUCTS' | 'OTHER';
  value: string;
  mentions: EntityMention[];
  relevanceScore: number;
  category?: string;
  reportId?: string;
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  extractedAt: string;
  processingTimeMs: number;
  sourceLength: number;
}

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  relevance: number;
  connectionCount: number;
  netWorth?: number;
  marketCap?: number;
  aum?: number;
  ticker?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  strength: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface TransformedGraphData {
  entities: { [key: string]: GraphNode };
  relationships: { from: string; to: string; type: string; strength: number }[];
}

export interface GraphEntitiesResponse {
  entities: Record<string, {
    type: 'person' | 'company' | 'fund';
    name: string;
    country?: string;
  }>;
  relationships: Array<[string, string, string]>;
}