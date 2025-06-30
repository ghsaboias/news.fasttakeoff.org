'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExtractedEntity } from '@/lib/types/core';
import { ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface EntityWithReports extends ExtractedEntity {
    reportIds: string[];
    reportCount: number;
}

const ENTITY_COLORS = {
    PERSON: 'bg-blue-100 text-blue-800 border-blue-200',
    ORGANIZATION: 'bg-green-100 text-green-800 border-green-200',
    LOCATION: 'bg-purple-100 text-purple-800 border-purple-200',
    EVENT: 'bg-orange-100 text-orange-800 border-orange-200',
    PRODUCT: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    MONEY: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    DATE: 'bg-pink-100 text-pink-800 border-pink-200',
    MISC: 'bg-gray-100 text-gray-800 border-gray-200',
};

const ENTITY_LABELS = {
    PERSON: 'People',
    ORGANIZATION: 'Organizations',
    LOCATION: 'Locations',
    EVENT: 'Events',
    PRODUCT: 'Products',
    MONEY: 'Financial',
    DATE: 'Dates',
    MISC: 'Other',
};

export default function EntitiesClient() {
    const [entities, setEntities] = useState<EntityWithReports[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState<string>('all');

    useEffect(() => {
        fetchEntities();
    }, []);

    const fetchEntities = async () => {
        try {
            const response = await fetch('/api/entities');
            if (!response.ok) throw new Error('Failed to fetch entities');

            const data = await response.json();

            // Aggregate entities across all reports
            const entityMap = new Map<string, EntityWithReports>();

            data.entities?.forEach((entity: ExtractedEntity) => {
                const key = `${entity.type}:${entity.value}`;
                if (entityMap.has(key)) {
                    const existing = entityMap.get(key)!;
                    existing.reportCount++;
                    existing.mentions.push(...entity.mentions);
                    existing.relevanceScore = Math.max(existing.relevanceScore, entity.relevanceScore);
                } else {
                    entityMap.set(key, {
                        ...entity,
                        reportIds: [], // We'd need to track this in the API
                        reportCount: 1,
                    });
                }
            });

            const aggregatedEntities = Array.from(entityMap.values())
                .sort((a, b) => b.reportCount - a.reportCount || b.relevanceScore - a.relevanceScore);

            setEntities(aggregatedEntities);
        } catch (error) {
            console.error('Error fetching entities:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredEntities = entities.filter(entity => {
        const matchesSearch = entity.value.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = selectedType === 'all' || entity.type === selectedType;
        return matchesSearch && matchesType;
    });

    const entityTypes = Array.from(new Set(entities.map(e => e.type)));

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader size="lg" className="mx-auto mb-4" />
                    <p className="text-lg text-muted-foreground">Loading entities...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                    <Link href="/current-events">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Reports
                        </Button>
                    </Link>
                </div>
                <h1 className="text-3xl font-bold mb-2">Entities</h1>
                <p className="text-muted-foreground">
                    Key people, organizations, and locations mentioned in news reports
                </p>
            </div>

            <div className="mb-4">
                <Link href="/entities/graph">
                    <Button variant="outline">
                        View Entity Graph
                    </Button>
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search entities..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {entityTypes.map(type => (
                            <SelectItem key={type} value={type}>
                                {ENTITY_LABELS[type as keyof typeof ENTITY_LABELS]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">{entities.length}</div>
                        <div className="text-sm text-gray-600">Total Entities</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">{entityTypes.length}</div>
                        <div className="text-sm text-gray-600">Entity Types</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">
                            {entities.reduce((sum, e) => sum + e.reportCount, 0)}
                        </div>
                        <div className="text-sm text-gray-600">Total Mentions</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">{filteredEntities.length}</div>
                        <div className="text-sm text-gray-600">Filtered</div>
                    </CardContent>
                </Card>
            </div>

            {/* Entity Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredEntities.map((entity, index) => (
                    <Card key={index} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                                <CardTitle className="text-lg line-clamp-2">
                                    {entity.value}
                                </CardTitle>
                                <Badge
                                    variant="outline"
                                    className={`${ENTITY_COLORS[entity.type]} text-xs shrink-0 ml-2`}
                                >
                                    {ENTITY_LABELS[entity.type as keyof typeof ENTITY_LABELS]}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Reports:</span>
                                    <span className="font-medium text-gray-900">{entity.reportCount}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Mentions:</span>
                                    <span className="font-medium text-gray-900">{entity.mentions.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Relevance:</span>
                                    <span className="font-medium text-gray-900">
                                        {(entity.relevanceScore * 100).toFixed(0)}%
                                    </span>
                                </div>
                                {entity.mentions.length > 0 && (
                                    <div className="pt-2 border-t">
                                        <p className="text-xs text-gray-600 mb-1">Recent mention:</p>
                                        <p className="text-xs line-clamp-2 text-gray-800">
                                            &ldquo;{entity.mentions[0].text}&rdquo;
                                        </p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredEntities.length === 0 && !loading && (
                <div className="text-center py-12">
                    <p className="text-lg text-gray-700">No entities found</p>
                    <p className="text-sm text-gray-600 mt-2">
                        Try adjusting your search or filter criteria
                    </p>
                </div>
            )}
        </div>
    );
} 