import { useMemo } from 'react';
import { EntityRelevanceScorer, type Entity, type EntityRelevanceScore, type Relationship } from '../utils/entity-relevance-scorer';

export interface GraphData {
    entities: Record<string, Entity>;
    relationships: Relationship[];
}

export interface UseEntityRelevanceResult {
    scorer: EntityRelevanceScorer;
    getEntityScore: (entityId: string) => EntityRelevanceScore;
    getTopEntities: (count?: number) => EntityRelevanceScore[];
    getTopEntitiesByScore: (count?: number) => EntityRelevanceScore[];
    getTopEntitiesByFinancialValue: (count?: number) => EntityRelevanceScore[];
    getAllScores: () => Map<string, EntityRelevanceScore>;
    isHighRelevance: (entityId: string) => boolean;
    isHighFinancialValue: (entityId: string) => boolean;
    shouldShowDetails: (entityId: string, threshold?: number) => boolean;
}

export function useEntityRelevance(graphData: GraphData | null): UseEntityRelevanceResult | null {
    const scorer = useMemo(() => {
        if (!graphData) return null;
        return new EntityRelevanceScorer(graphData.entities, graphData.relationships);
    }, [graphData]);

    const memoizedResults = useMemo(() => {
        if (!scorer) return null;

        const getEntityScore = (entityId: string): EntityRelevanceScore => {
            return scorer.scoreEntity(entityId);
        };

        const getTopEntities = (count: number = 20): EntityRelevanceScore[] => {
            return scorer.getTopEntities(count);
        };

        const getTopEntitiesByScore = (count: number = 20): EntityRelevanceScore[] => {
            return scorer.getTopEntitiesByScore(count);
        };

        const getTopEntitiesByFinancialValue = (count: number = 20): EntityRelevanceScore[] => {
            return scorer.getTopEntities(count); // This already sorts by financial value
        };

        const getAllScores = (): Map<string, EntityRelevanceScore> => {
            return scorer.scoreAllEntities();
        };

        const isHighRelevance = (entityId: string): boolean => {
            const score = scorer.scoreEntity(entityId);
            return score.detailLevel >= 4;
        };

        const isHighFinancialValue = (entityId: string): boolean => {
            const score = scorer.scoreEntity(entityId);
            return score.financialValue >= 10; // $10B+ is considered high financial value
        };

        const shouldShowDetails = (entityId: string, threshold: number = 3): boolean => {
            const score = scorer.scoreEntity(entityId);
            return score.detailLevel >= threshold;
        };

        return {
            scorer,
            getEntityScore,
            getTopEntities,
            getTopEntitiesByScore,
            getTopEntitiesByFinancialValue,
            getAllScores,
            isHighRelevance,
            isHighFinancialValue,
            shouldShowDetails,
        };
    }, [scorer]);

    return memoizedResults;
}

// Utility function to format entity relevance for display
export function formatEntityRelevance(score: EntityRelevanceScore): string {
    const levelNames = {
        1: 'Minimal',
        2: 'Low',
        3: 'Medium',
        4: 'High',
        5: 'Maximum'
    };

    return `${levelNames[score.detailLevel]} (${score.score.toFixed(1)})`;
}

// Utility function to format financial value for display
export function formatFinancialValue(score: EntityRelevanceScore): string {
    const value = score.financialValue;
    if (value >= 1000) {
        return `$${(value / 1000).toFixed(1)}T`;
    } else if (value >= 1) {
        return `$${value.toFixed(1)}B`;
    } else if (value >= 0.1) {
        return `$${(value * 1000).toFixed(0)}M`;
    } else if (value > 0) {
        return `$${(value * 1000).toFixed(1)}M`;
    } else {
        return 'N/A';
    }
}

// Utility function to get display class based on relevance
export function getRelevanceDisplayClass(score: EntityRelevanceScore): string {
    const classes = {
        1: 'opacity-50 text-gray-400',
        2: 'opacity-70 text-gray-300',
        3: 'opacity-85 text-white',
        4: 'opacity-100 text-white font-medium',
        5: 'opacity-100 text-cyan-300 font-bold'
    };

    return classes[score.detailLevel];
}

// Utility function to get display class based on financial value
export function getFinancialValueDisplayClass(score: EntityRelevanceScore): string {
    const value = score.financialValue;
    if (value >= 100) {
        return 'text-yellow-300 font-bold'; // Mega-wealth
    } else if (value >= 50) {
        return 'text-yellow-400 font-medium'; // Ultra-wealth
    } else if (value >= 10) {
        return 'text-green-400 font-medium'; // High wealth
    } else if (value >= 1) {
        return 'text-green-300'; // Wealth
    } else if (value >= 0.1) {
        return 'text-blue-300'; // Emerging
    } else {
        return 'text-gray-400'; // No significant financial data
    }
} 