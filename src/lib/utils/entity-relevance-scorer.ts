// Entity types for the Power Network
export interface Entity {
    type: 'person' | 'company' | 'fund';
    name: string;
    country?: string;
    // Financial metrics in billions USD
    netWorth?: number;    // For persons (in billions)
    marketCap?: number;   // For companies (in trillions, so multiply by 1000 for billions)
    aum?: number;         // For funds (in trillions, so multiply by 1000 for billions)
}

export interface Relationship {
    from: string;
    to: string;
    type: string;
    strength?: number;
}

export interface EntityRelevanceScore {
    entityId: string;
    score: number;
    detailLevel: 1 | 2 | 3 | 4 | 5;
    reasons: string[];
    financialValue: number; // Total financial value in billions USD
}



// Financial tier classification based on actual dollar values
const FINANCIAL_TIERS = {
    MEGA_WEALTH: 100, // $100B+ net worth
    ULTRA_WEALTH: 50, // $50-100B net worth  
    HIGH_WEALTH: 10,  // $10-50B net worth
    WEALTH: 1,        // $1-10B net worth
    EMERGING: 0.1     // $100M+ net worth
};

const MARKET_CAP_TIERS = {
    MEGA_CAP: 1000,   // $1T+ market cap
    LARGE_CAP: 100,   // $100B-1T market cap
    MID_CAP: 10,      // $10-100B market cap
    SMALL_CAP: 1,     // $1-10B market cap
    MICRO_CAP: 0.1    // $100M+ market cap
};

const AUM_TIERS = {
    MEGA_FUND: 1000,  // $1T+ AUM
    LARGE_FUND: 100,  // $100B-1T AUM
    MID_FUND: 10,     // $10-100B AUM
    SMALL_FUND: 1,    // $1-10B AUM
    MICRO_FUND: 0.1   // $100M+ AUM
};

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
        // Financial relationship weights based on control and value
        const weights: Record<string, number> = {
            // Ownership/Control (highest weight)
            'owns_majority_stake_in': 3.5,
            'controlling_shareholder_of': 3.5,
            'founder_and_majority_owner': 3.5,

            // Major Investment 
            'major_shareholder_in': 3.0,
            'lead_investor_in': 3.0,
            'strategic_investor_in': 3.0,

            // Executive Control
            'founder_and_ceo_of': 2.5,
            'executive_chairman_of': 2.5,
            'managing_partner_of': 2.5,

            // Board Influence
            'board_member_of': 2.0,
            'independent_director_of': 2.0,
            'advisory_board_member_of': 2.0,

            // Legacy relationships
            'founder_of': 2.8,
            'ceo_of': 2.5,
            'chairman_of': 2.3,
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

    private getFinancialValue(entity: Entity): number {
        // Calculate financial value in billions USD
        let value = 0;

        if (entity.netWorth) {
            value = entity.netWorth; // Already in billions
        } else if (entity.marketCap) {
            value = entity.marketCap * 1000; // Convert trillions to billions
        } else if (entity.aum) {
            value = entity.aum * 1000; // Convert trillions to billions
        }

        return value;
    }

    private getFinancialScore(entity: Entity): { score: number, reasons: string[] } {
        const reasons: string[] = [];
        let score = 0;

        if (entity.type === 'person' && entity.netWorth) {
            const netWorth = entity.netWorth;
            if (netWorth >= FINANCIAL_TIERS.MEGA_WEALTH) {
                score = netWorth * 0.4; // 40% weight for individual net worth
                reasons.push(`$${netWorth.toFixed(1)}B net worth (Mega-wealth)`);
            } else if (netWorth >= FINANCIAL_TIERS.ULTRA_WEALTH) {
                score = netWorth * 0.35;
                reasons.push(`$${netWorth.toFixed(1)}B net worth (Ultra-wealth)`);
            } else if (netWorth >= FINANCIAL_TIERS.HIGH_WEALTH) {
                score = netWorth * 0.25;
                reasons.push(`$${netWorth.toFixed(1)}B net worth (High wealth)`);
            } else if (netWorth >= FINANCIAL_TIERS.WEALTH) {
                score = netWorth * 0.15;
                reasons.push(`$${netWorth.toFixed(1)}B net worth`);
            } else if (netWorth >= FINANCIAL_TIERS.EMERGING) {
                score = netWorth * 0.05;
                reasons.push(`$${(netWorth * 1000).toFixed(0)}M net worth`);
            }
        } else if (entity.type === 'company' && entity.marketCap) {
            const marketCapBillions = entity.marketCap * 1000;
            if (marketCapBillions >= MARKET_CAP_TIERS.MEGA_CAP) {
                score = marketCapBillions * 0.35; // 35% weight for company market cap
                reasons.push(`$${entity.marketCap.toFixed(2)}T market cap (Mega-cap)`);
            } else if (marketCapBillions >= MARKET_CAP_TIERS.LARGE_CAP) {
                score = marketCapBillions * 0.30;
                reasons.push(`$${marketCapBillions.toFixed(0)}B market cap (Large-cap)`);
            } else if (marketCapBillions >= MARKET_CAP_TIERS.MID_CAP) {
                score = marketCapBillions * 0.20;
                reasons.push(`$${marketCapBillions.toFixed(0)}B market cap (Mid-cap)`);
            } else if (marketCapBillions >= MARKET_CAP_TIERS.SMALL_CAP) {
                score = marketCapBillions * 0.10;
                reasons.push(`$${marketCapBillions.toFixed(1)}B market cap`);
            } else if (marketCapBillions >= MARKET_CAP_TIERS.MICRO_CAP) {
                score = marketCapBillions * 0.03;
                reasons.push(`$${(marketCapBillions * 1000).toFixed(0)}M market cap`);
            }
        } else if (entity.type === 'fund' && entity.aum) {
            const aumBillions = entity.aum * 1000;
            if (aumBillions >= AUM_TIERS.MEGA_FUND) {
                score = aumBillions * 0.25; // 25% weight for fund AUM
                reasons.push(`$${entity.aum.toFixed(1)}T AUM (Mega-fund)`);
            } else if (aumBillions >= AUM_TIERS.LARGE_FUND) {
                score = aumBillions * 0.25;
                reasons.push(`$${aumBillions.toFixed(0)}B AUM (Large fund)`);
            } else if (aumBillions >= AUM_TIERS.MID_FUND) {
                score = aumBillions * 0.15;
                reasons.push(`$${aumBillions.toFixed(0)}B AUM`);
            } else if (aumBillions >= AUM_TIERS.SMALL_FUND) {
                score = aumBillions * 0.08;
                reasons.push(`$${aumBillions.toFixed(1)}B AUM`);
            } else if (aumBillions >= AUM_TIERS.MICRO_FUND) {
                score = aumBillions * 0.02;
                reasons.push(`$${(aumBillions * 1000).toFixed(0)}M AUM`);
            }
        }

        return { score, reasons };
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
        const financialValue = this.getFinancialValue(entity);

        // Primary financial scoring
        const financialResult = this.getFinancialScore(entity);
        score += financialResult.score;
        reasons.push(...financialResult.reasons);

        // Connection-based scoring (reduced weight in favor of financial metrics)
        const connectionCount = this.connectionCounts.get(entityId) || 0;
        const weightedConnections = this.calculateWeightedConnections(entityId);
        const connectionScore = (connectionCount * 0.1 + weightedConnections * 0.2) * 0.3;
        score += connectionScore;

        if (connectionCount > 15) {
            reasons.push(`Highly connected (${connectionCount} connections)`);
        }

        // Centrality bonus (reduced weight)
        const centralityScore = this.centralityScores.get(entityId) || 0;
        if (centralityScore > 10) {
            score += centralityScore * 0.05;
            reasons.push('High network centrality');
        }

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
            score = Math.max(score, 50); // Ensure adequate detail for context
            reasons.push('Requires contextual handling');
        }

        // Determine detail level based on financial value and score
        let detailLevel: 1 | 2 | 3 | 4 | 5;
        if (financialValue >= 100 || score >= 100) detailLevel = 5;  // $100B+ or high score
        else if (financialValue >= 50 || score >= 50) detailLevel = 4;   // $50B+ or medium-high score
        else if (financialValue >= 10 || score >= 20) detailLevel = 3;   // $10B+ or medium score
        else if (financialValue >= 1 || score >= 5) detailLevel = 2;     // $1B+ or low score
        else detailLevel = 1;

        return {
            entityId,
            score: Math.round(score * 100) / 100,
            detailLevel,
            reasons,
            financialValue,
        };
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
            .sort((a, b) => b.financialValue - a.financialValue) // Sort by financial value first
            .slice(0, count);
    }

    public getTopEntitiesByScore(count: number = 20): EntityRelevanceScore[] {
        const allScores = Array.from(this.scoreAllEntities().values());
        return allScores
            .sort((a, b) => b.score - a.score) // Sort by total score
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