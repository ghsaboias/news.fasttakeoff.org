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
    getAllScores: () => Map<string, EntityRelevanceScore>;
    isHighRelevance: (entityId: string) => boolean;
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

        const getAllScores = (): Map<string, EntityRelevanceScore> => {
            return scorer.scoreAllEntities();
        };

        const isHighRelevance = (entityId: string): boolean => {
            const score = scorer.scoreEntity(entityId);
            return score.detailLevel >= 4;
        };

        const shouldShowDetails = (entityId: string, threshold: number = 3): boolean => {
            const score = scorer.scoreEntity(entityId);
            return score.detailLevel >= threshold;
        };

        return {
            scorer,
            getEntityScore,
            getTopEntities,
            getAllScores,
            isHighRelevance,
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