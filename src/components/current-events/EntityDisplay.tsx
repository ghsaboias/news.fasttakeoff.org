'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExtractedEntity } from '@/lib/types/entities';

interface EntityDisplayProps {
    entities: ExtractedEntity[];
    showMentions?: boolean;
    maxPerType?: number;
}

const ENTITY_COLORS = {
    PERSON: 'bg-blue-100 text-blue-800 border-blue-200',
    ORGANIZATION: 'bg-green-100 text-green-800 border-green-200',
    LOCATION: 'bg-purple-100 text-purple-800 border-purple-200',
};

const ENTITY_LABELS = {
    PERSON: 'People',
    ORGANIZATION: 'Organizations',
    LOCATION: 'Locations',
};

export function EntityDisplay({ entities, showMentions = false, maxPerType = 5 }: EntityDisplayProps) {
    if (!entities || entities.length === 0) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="text-sm">Entities</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-500">No entities found</p>
                </CardContent>
            </Card>
        );
    }

    // Group entities by type
    const groupedEntities = entities.reduce((acc, entity) => {
        if (!acc[entity.type]) {
            acc[entity.type] = [];
        }
        if (acc[entity.type].length < maxPerType) {
            acc[entity.type].push(entity);
        }
        return acc;
    }, {} as Record<string, ExtractedEntity[]>);

    // Sort entity types by importance (based on total relevance score)
    const sortedTypes = Object.keys(groupedEntities).sort((a, b) => {
        const aScore = groupedEntities[a].reduce((sum, e) => sum + e.relevanceScore, 0);
        const bScore = groupedEntities[b].reduce((sum, e) => sum + e.relevanceScore, 0);
        return bScore - aScore;
    });

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-sm">Entities ({entities.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {sortedTypes.map(type => (
                    <div key={type}>
                        <h4 className="text-xs font-medium text-gray-600 mb-2">
                            {ENTITY_LABELS[type as keyof typeof ENTITY_LABELS]}
                        </h4>
                        <div className="flex flex-wrap gap-1">
                            {groupedEntities[type].map((entity, index) => (
                                <EntityBadge
                                    key={`${entity.value}-${index}`}
                                    entity={entity}
                                    showMentions={showMentions}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

interface EntityBadgeProps {
    entity: ExtractedEntity;
    showMentions?: boolean;
}

function EntityBadge({ entity, showMentions }: EntityBadgeProps) {
    const colorClass = ENTITY_COLORS[entity.type as keyof typeof ENTITY_COLORS] || 'bg-gray-100 text-gray-800 border-gray-200';
    const confidenceScore = entity.mentions.reduce((sum, m) => sum + m.confidence, 0) / entity.mentions.length;

    return (
        <div className="group relative">
            <Badge
                variant="outline"
                className={`${colorClass} text-xs cursor-help`}
                title={`Relevance: ${(entity.relevanceScore * 100).toFixed(0)}% | Confidence: ${(confidenceScore * 100).toFixed(0)}%`}
            >
                {entity.value}
                {entity.mentions.length > 1 && (
                    <span className="ml-1 text-xs opacity-70">
                        ({entity.mentions.length})
                    </span>
                )}
            </Badge>

            {showMentions && entity.mentions.length > 0 && (
                <div className="absolute z-10 invisible group-hover:visible bg-black text-white text-xs rounded p-2 mt-1 max-w-xs">
                    <div className="font-medium mb-1">Mentions:</div>
                    {entity.mentions.slice(0, 3).map((mention) => (
                        <div key={mention.text} className="text-xs opacity-90">
                            &ldquo;{mention.text}&rdquo; ({(mention.confidence * 100).toFixed(0)}%)
                        </div>
                    ))}
                    {entity.mentions.length > 3 && (
                        <div className="text-xs opacity-70">
                            +{entity.mentions.length - 3} more
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

interface EntitySummaryProps {
    entities: ExtractedEntity[];
}

export function EntitySummary({ entities }: EntitySummaryProps) {
    if (!entities || entities.length === 0) return null;

    const typeCounts = entities.reduce((acc, entity) => {
        acc[entity.type] = (acc[entity.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const topEntities = entities
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 3);

    return (
        <div className="text-xs text-gray-600 space-y-1">
            <div>
                {Object.entries(typeCounts).map(([type, count], index) => (
                    <span key={type}>
                        {index > 0 && ' • '}
                        {count} {ENTITY_LABELS[type as keyof typeof ENTITY_LABELS]?.toLowerCase()}
                    </span>
                ))}
            </div>
            {topEntities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {topEntities.map((entity) => (
                        <Badge key={entity.value} variant="secondary" className="text-xs">
                            {entity.value}
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
} 