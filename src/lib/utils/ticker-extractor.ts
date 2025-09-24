import fs from 'fs/promises';

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  ticker?: string;
  fetchTicker?: string | null;
  marketCap?: number;
  netWorth?: number;
  aum?: number;
  exchange?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: Array<{
    source: string;
    target: string;
  }>;
}

export interface QueueMessage {
  ticker: string;
  fetchTicker?: string;
  entityId: string;
  name: string;
  marketCap?: number;
  timestamp: string;
}

export class TickerExtractor {
  constructor(private graphData: GraphData) {}

  static async fromFile(filePath: string): Promise<TickerExtractor> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const graphData = JSON.parse(content);
      return new TickerExtractor(graphData);
    } catch (error) {
      throw new Error(`Failed to parse graph.json: ${error}`);
    }
  }

  extractAllTickers(): string[] {
    return this.graphData.nodes
      .filter(node =>
        node.type === 'company' &&
        node.ticker &&
        node.fetchTicker !== null // Exclude private companies
      )
      .map(node => node.ticker!)
      .filter((ticker, index, arr) => arr.indexOf(ticker) === index) // Unique values
      .sort();
  }

  extractTickersWithOverrides(): Array<{
    ticker: string;
    fetchTicker?: string;
    entityId: string;
    name: string;
  }> {
    return this.graphData.nodes
      .filter(node =>
        node.type === 'company' &&
        node.ticker &&
        node.fetchTicker !== null
      )
      .map(node => ({
        ticker: node.ticker!,
        fetchTicker: node.fetchTicker || undefined,
        entityId: node.id,
        name: node.name,
      }));
  }

  getMissingTickers(currentlyFetched: string[]): string[] {
    const allTickers = this.extractAllTickers();
    return allTickers.filter(ticker => !currentlyFetched.includes(ticker));
  }

  groupByExchange(): Record<string, string[]> {
    const groups: Record<string, string[]> = {};

    this.graphData.nodes
      .filter(node => node.type === 'company' && node.ticker && node.exchange)
      .forEach(node => {
        const exchange = node.exchange!;
        if (!groups[exchange]) {
          groups[exchange] = [];
        }
        groups[exchange].push(node.ticker!);
      });

    return groups;
  }

  extractByMarketCapThreshold(thresholdInTrillions: number): string[] {
    return this.graphData.nodes
      .filter(node =>
        node.type === 'company' &&
        node.ticker &&
        node.marketCap &&
        node.marketCap >= thresholdInTrillions
      )
      .map(node => node.ticker!)
      .sort();
  }

  getCompanyMetadata(ticker: string): GraphNode | null {
    const node = this.graphData.nodes.find(node =>
      node.type === 'company' && node.ticker === ticker
    );
    return node || null;
  }

  generateQueueMessages(): QueueMessage[] {
    return this.graphData.nodes
      .filter(node =>
        node.type === 'company' &&
        node.ticker &&
        node.fetchTicker !== null // Exclude private companies
      )
      .map(node => ({
        ticker: node.ticker!,
        fetchTicker: node.fetchTicker || undefined,
        entityId: node.id,
        name: node.name,
        marketCap: node.marketCap,
        timestamp: new Date().toISOString(),
      }));
  }

  getEntityCount(): {
    companies: number;
    people: number;
    funds: number;
    total: number;
  } {
    const counts = { companies: 0, people: 0, funds: 0, total: 0 };

    this.graphData.nodes.forEach(node => {
      counts.total++;
      switch (node.type) {
        case 'company':
          counts.companies++;
          break;
        case 'person':
          counts.people++;
          break;
        case 'fund':
          counts.funds++;
          break;
      }
    });

    return counts;
  }

  getTickerStats(): {
    totalTickers: number;
    publicTickers: number;
    privateTickers: number;
    withExchange: number;
  } {
    const companyNodes = this.graphData.nodes.filter(node => node.type === 'company');

    return {
      totalTickers: companyNodes.filter(node => node.ticker).length,
      publicTickers: companyNodes.filter(node => node.ticker && node.fetchTicker !== null).length,
      privateTickers: companyNodes.filter(node => node.ticker && node.fetchTicker === null).length,
      withExchange: companyNodes.filter(node => node.ticker && node.exchange).length,
    };
  }
}