// Entity types for the Power Network
export interface Entity {
    type: 'person' | 'company' | 'fund';
    name: string;
    country?: string;
}

export interface Relationship {
    from: string;
    to: string;
    type: string;
}

export interface EntityRelevanceScore {
    entityId: string;
    score: number;
    detailLevel: 1 | 2 | 3 | 4 | 5;
    reasons: string[];
}

export interface DetailLevelConfig {
    level: 1 | 2 | 3 | 4 | 5;
    title: string;
    description: string;
    showConnections: number;
    showBiography: boolean;
    showMarketData: boolean;
    showRecentNews: boolean;
    showControversies: boolean;
}

const DETAIL_LEVELS: Record<number, DetailLevelConfig> = {
    5: {
        level: 5,
        title: 'Maximum Detail',
        description: 'Full profile with complete context',
        showConnections: -1, // All connections
        showBiography: true,
        showMarketData: true,
        showRecentNews: true,
        showControversies: true,
    },
    4: {
        level: 4,
        title: 'High Detail',
        description: 'Extended profile with key relationships',
        showConnections: 10,
        showBiography: true,
        showMarketData: true,
        showRecentNews: true,
        showControversies: false,
    },
    3: {
        level: 3,
        title: 'Medium Detail',
        description: 'Standard profile with primary relationships',
        showConnections: 5,
        showBiography: false,
        showMarketData: true,
        showRecentNews: false,
        showControversies: false,
    },
    2: {
        level: 2,
        title: 'Low Detail',
        description: 'Basic profile with core relationships',
        showConnections: 3,
        showBiography: false,
        showMarketData: false,
        showRecentNews: false,
        showControversies: false,
    },
    1: {
        level: 1,
        title: 'Minimal Detail',
        description: 'Name and primary role only',
        showConnections: 1,
        showBiography: false,
        showMarketData: false,
        showRecentNews: false,
        showControversies: false,
    },
};

// High-influence entities that should always get maximum detail
const TIER_1_ENTITIES = new Set([
    'elon-musk', 'bill-gates', 'jeff-bezos', 'mark-zuckerberg',
    'larry-page', 'sergey-brin', 'warren-buffett', 'larry-fink',
    'tim-cook', 'sundar-pichai', 'satya-nadella', 'jensen-huang',
    'sam-altman', 'peter-thiel', 'marc-andreessen', 'reid-hoffman'
]);

// Important but second-tier entities
const TIER_2_ENTITIES = new Set([
    'larry-ellison', 'michael-dell', 'brian-chesky', 'drew-houston',
    'daniel-ek', 'tobias-lutke', 'jack-dorsey', 'masayoshi-son',
    'bernard-arnault', 'mukesh-ambani', 'jamie-dimon'
]);

// Controversial/sensitive entities requiring careful handling
const CONTROVERSIAL_ENTITIES = new Set([
    'jeffrey-epstein'
]);

export class EntityRelevanceScorer {
    private entities: Record<string, Entity>;
    private relationships: Relationship[];
    private connectionCounts: Map<string, number>;
    private centralityScores: Map<string, number>;

    constructor(entities: Record<string, Entity>, relationships: Relationship[]) {
        this.entities = entities;
        this.relationships = relationships;
        this.connectionCounts = this.calculateConnectionCounts();
        this.centralityScores = this.calculateCentralityScores();
    }

    private calculateConnectionCounts(): Map<string, number> {
        const counts = new Map<string, number>();

        // Initialize all entities with 0 connections
        Object.keys(this.entities).forEach(id => counts.set(id, 0));

        // Count connections
        this.relationships.forEach(rel => {
            counts.set(rel.from, (counts.get(rel.from) || 0) + 1);
            counts.set(rel.to, (counts.get(rel.to) || 0) + 1);
        });

        return counts;
    }

    private calculateCentralityScores(): Map<string, number> {
        const scores = new Map<string, number>();
        const entityIds = Object.keys(this.entities);

        // Simple betweenness centrality approximation
        entityIds.forEach(entityId => {
            const connections = this.relationships.filter(
                rel => rel.from === entityId || rel.to === entityId
            );

            // Count unique entities connected through this entity
            const connectedEntities = new Set<string>();
            connections.forEach(rel => {
                connectedEntities.add(rel.from === entityId ? rel.to : rel.from);
            });

            // Score based on diversity of connections
            scores.set(entityId, connectedEntities.size);
        });

        return scores;
    }

    private getRelationshipWeight(relType: string): number {
        const weights: Record<string, number> = {
            'founder_and_ceo_of': 3.0,
            'founder_of': 2.8,
            'ceo_of': 2.5,
            'chairman_of': 2.3,
            'board_member_of': 2.0,
            'invests_in': 1.8,
            'owns_equity_in': 1.7,
            'partner_of': 1.5,
            'ex_board_member_of': 1.2,
            'ex_employee_of': 1.0,
            'supplies_to': 0.8,
            'associated_with': 0.5,
            'client_of': 0.3,
        };

        return weights[relType] || 1.0;
    }

    private calculateWeightedConnections(entityId: string): number {
        const connections = this.relationships.filter(
            rel => rel.from === entityId || rel.to === entityId
        );

        return connections.reduce((total, rel) => {
            return total + this.getRelationshipWeight(rel.type);
        }, 0);
    }

    private getEntityTypeMultiplier(entityType: string): number {
        const multipliers: Record<string, number> = {
            'person': 1.2,
            'company': 1.0,
            'fund': 1.1,
        };

        return multipliers[entityType] || 1.0;
    }

    private getGeographicMultiplier(country?: string): number {
        if (!country) return 1.0;

        const multipliers: Record<string, number> = {
            'US': 1.2,
            'China': 1.1,
            'Japan': 1.05,
            'Germany': 1.05,
            'UK': 1.05,
            'France': 1.05,
        };

        return multipliers[country] || 1.0;
    }

    private getSectorMultiplier(entityId: string): number {
        // AI/Tech sector entities
        const aiTechEntities = new Set([
            'openai', 'anthropic', 'google', 'microsoft', 'nvidia', 'apple',
            'meta', 'tesla', 'spacex', 'xai', 'perplexity', 'scale-ai'
        ]);

        // Financial entities
        const financialEntities = new Set([
            'blackrock', 'berkshire-hathaway', 'jpmorgan-chase', 'goldman-sachs',
            'sequoia-capital', 'andreessen-horowitz', 'y-combinator'
        ]);

        if (aiTechEntities.has(entityId)) return 1.3;
        if (financialEntities.has(entityId)) return 1.2;

        return 1.0;
    }

    public scoreEntity(entityId: string): EntityRelevanceScore {
        const entity = this.entities[entityId];
        if (!entity) {
            throw new Error(`Entity not found: ${entityId}`);
        }

        const reasons: string[] = [];
        let score = 0;

        // Handle tier-based scoring
        if (TIER_1_ENTITIES.has(entityId)) {
            score += 50;
            reasons.push('Tier 1 global influence');
        } else if (TIER_2_ENTITIES.has(entityId)) {
            score += 35;
            reasons.push('Tier 2 significant influence');
        }

        // Connection-based scoring
        const connectionCount = this.connectionCounts.get(entityId) || 0;
        const weightedConnections = this.calculateWeightedConnections(entityId);
        const connectionScore = (connectionCount * 0.3 + weightedConnections * 0.7) * 0.8;
        score += connectionScore;

        if (connectionCount > 15) {
            reasons.push(`Highly connected (${connectionCount} connections)`);
        }

        // Centrality bonus
        const centralityScore = this.centralityScores.get(entityId) || 0;
        if (centralityScore > 10) {
            score += centralityScore * 0.2;
            reasons.push('High network centrality');
        }

        // Entity type multiplier
        const typeMultiplier = this.getEntityTypeMultiplier(entity.type);
        score *= typeMultiplier;

        // Geographic multiplier
        const geoMultiplier = this.getGeographicMultiplier(entity.country);
        score *= geoMultiplier;

        // Sector multiplier
        const sectorMultiplier = this.getSectorMultiplier(entityId);
        score *= sectorMultiplier;

        if (sectorMultiplier > 1.1) {
            reasons.push('High-impact sector');
        }

        // Handle controversial entities
        if (CONTROVERSIAL_ENTITIES.has(entityId)) {
            score = Math.max(score, 45); // Ensure adequate detail for context
            reasons.push('Requires contextual handling');
        }

        // Determine detail level
        let detailLevel: 1 | 2 | 3 | 4 | 5;
        if (score >= 50) detailLevel = 5;
        else if (score >= 30) detailLevel = 4;
        else if (score >= 15) detailLevel = 3;
        else if (score >= 5) detailLevel = 2;
        else detailLevel = 1;

        return {
            entityId,
            score: Math.round(score * 100) / 100,
            detailLevel,
            reasons,
        };
    }

    public getDetailConfig(detailLevel: 1 | 2 | 3 | 4 | 5): DetailLevelConfig {
        return DETAIL_LEVELS[detailLevel];
    }

    public scoreAllEntities(): Map<string, EntityRelevanceScore> {
        const scores = new Map<string, EntityRelevanceScore>();

        Object.keys(this.entities).forEach(entityId => {
            scores.set(entityId, this.scoreEntity(entityId));
        });

        return scores;
    }

    public getTopEntities(count: number = 20): EntityRelevanceScore[] {
        const allScores = Array.from(this.scoreAllEntities().values());
        return allScores
            .sort((a, b) => b.score - a.score)
            .slice(0, count);
    }
}

// Utility function to get appropriate detail level for entity display
export function getEntityDetailLevel(
    entityId: string,
    entities: Record<string, Entity>,
    relationships: Relationship[]
): EntityRelevanceScore {
    const scorer = new EntityRelevanceScorer(entities, relationships);
    return scorer.scoreEntity(entityId);
} 