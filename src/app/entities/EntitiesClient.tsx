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

const ENTITY_COLORS: Record<string, string> = {
    PERSON: 'bg-blue-100 text-blue-800',
    ORGANIZATION: 'bg-purple-100 text-purple-800',
    LOCATION: 'bg-green-100 text-green-800',
    EVENTS: 'bg-yellow-100 text-yellow-800',
    DATES: 'bg-orange-100 text-orange-800',
    FINANCIAL: 'bg-emerald-100 text-emerald-800',
    PRODUCTS: 'bg-pink-100 text-pink-800',
    OTHER: 'bg-gray-100 text-gray-800'
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
    PERSON: 'People',
    ORGANIZATION: 'Organizations',
    LOCATION: 'Locations',
    EVENTS: 'Events',
    DATES: 'Dates',
    FINANCIAL: 'Financial',
    PRODUCTS: 'Products',
    OTHER: 'Other'
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

            // Entities now come with reportIds from the API
            const aggregatedEntities = data.entities.map((entity: EntityWithReports) => ({
                ...entity,
                reportCount: entity.reportIds.length
            }));

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
                                {ENTITY_TYPE_LABELS[type as keyof typeof ENTITY_TYPE_LABELS]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
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
                                    {ENTITY_TYPE_LABELS[entity.type as keyof typeof ENTITY_TYPE_LABELS]}
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