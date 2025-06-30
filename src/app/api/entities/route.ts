import { withErrorHandling } from '@/lib/api-utils';
import { ReportService } from '@/lib/data/report-service';
import { ExtractedEntity, GraphLink, GraphNode } from '@/lib/types/core';
import { EntityExtractor } from '@/lib/utils/entity-extraction';
import { NextResponse } from 'next/server';

interface EntityExtractionRequest {
    text?: string;
    reportId?: string;
    channelId?: string;
    sourceType?: 'report' | 'message' | 'summary';
    options?: {
        minRelevance?: number;
        entityTypes?: string[];
        maxPerType?: number;
    };
}

export async function POST(request: Request) {
    return withErrorHandling(async (env) => {
        const body: EntityExtractionRequest = await request.json();
        const { text, reportId, channelId, sourceType = 'message', options = {} } = body;

        if (!text) {
            return NextResponse.json(
                { error: 'Text is required' },
                { status: 400 }
            );
        }

        const {
            minRelevance = 0.3,
            entityTypes,
            maxPerType = 10
        } = options;

        // Extract entities
        const extractionResult = await EntityExtractor.extract(text, {
            reportId,
            channelId,
            sourceType,
        }, env);

        // Filter entities
        const filteredEntities = EntityExtractor.filterEntities(
            extractionResult.entities,
            entityTypes as ExtractedEntity['type'][],
            minRelevance
        );

        // Group by type and limit per type
        const topEntitiesByType = EntityExtractor.getTopEntitiesByType(
            filteredEntities,
            maxPerType
        );

        return {
            ...extractionResult,
            entities: Object.values(topEntitiesByType).flat(),
            summary: {
                totalEntities: extractionResult.entities.length,
                filteredEntities: filteredEntities.length,
                entityTypes: [...new Set(filteredEntities.map(e => e.type))],
                topEntities: filteredEntities.slice(0, 5).map(e => ({
                    type: e.type,
                    value: e.value,
                    relevanceScore: e.relevanceScore
                }))
            }
        };
    }, 'Failed to extract entities');
}

export async function GET(request: Request) {
    return withErrorHandling(async env => {
        const url = new URL(request.url);
        const reportId = url.searchParams.get('reportId');
        const format = url.searchParams.get('format');

        // If reportId is provided, get entities for specific report
        if (reportId) {
            const extractionResult = await EntityExtractor.getCachedEntities(reportId, env);
            if (!extractionResult) {
                return NextResponse.json(
                    { error: 'Entities not found for this report' },
                    { status: 404 }
                );
            }
            return { entities: extractionResult.entities };
        }

        const reportService = new ReportService(env);
        const reportsWithEntities = await reportService.getReportsWithEntities(100);

        if (format === 'graph') {
            const nodes: GraphNode[] = [];
            const links: GraphLink[] = [];
            const nodeMap = new Map<string, GraphNode>();

            function getNodeId(entity: ExtractedEntity) {
                return `${entity.type}:${entity.value.toLowerCase()}`;
            }

            // First pass: create all nodes
            reportsWithEntities.forEach(report => {
                if (report.entities?.entities) {
                    report.entities.entities.forEach(entity => {
                        const nodeId = getNodeId(entity);
                        if (!nodeMap.has(nodeId)) {
                            const newNode = {
                                id: nodeId,
                                name: entity.value,
                                type: entity.type,
                                relevance: entity.relevanceScore,
                                connectionCount: 0,
                            };
                            nodeMap.set(nodeId, newNode);
                            nodes.push(newNode);
                        }
                    });
                }
            });

            const linkMap = new Map<string, GraphLink>();

            // Second pass: create links
            reportsWithEntities.forEach(report => {
                if (report.entities?.entities && report.entities.entities.length > 1) {
                    const reportEntities = report.entities.entities;
                    for (let i = 0; i < reportEntities.length; i++) {
                        for (let j = i + 1; j < reportEntities.length; j++) {
                            const nodeAId = getNodeId(reportEntities[i]);
                            const nodeBId = getNodeId(reportEntities[j]);

                            if (nodeAId === nodeBId) continue;

                            const linkKey = [nodeAId, nodeBId].sort().join('--');
                            const existingLink = linkMap.get(linkKey);
                            if (existingLink) {
                                existingLink.strength++;
                            } else {
                                linkMap.set(linkKey, {
                                    source: nodeAId,
                                    target: nodeBId,
                                    strength: 1,
                                });
                            }
                        }
                    }
                }
            });

            links.push(...linkMap.values());

            // Calculate connection count for each node
            links.forEach(link => {
                const sourceNode = nodeMap.get(link.source);
                const targetNode = nodeMap.get(link.target);
                if (sourceNode) sourceNode.connectionCount++;
                if (targetNode) targetNode.connectionCount++;
            });

            const minConnections = 2;
            const connectedNodes = nodes.filter(n => n.connectionCount >= minConnections);
            const connectedNodeIds = new Set(connectedNodes.map(n => n.id));

            const filteredLinks = links.filter(l =>
                connectedNodeIds.has(l.source) && connectedNodeIds.has(l.target)
            );

            return {
                nodes: connectedNodes,
                links: filteredLinks,
            };
        }

        // Otherwise, get aggregated entities from all reports
        const allEntities: ExtractedEntity[] = [];
        reportsWithEntities.forEach(report => {
            if (report.entities?.entities) {
                allEntities.push(...report.entities.entities);
            }
        });

        // Filter and deduplicate entities by value and type
        const entityMap = new Map<string, ExtractedEntity>();
        allEntities.forEach(entity => {
            const key = `${entity.type}:${entity.value.toLowerCase()}`;
            const existing = entityMap.get(key);

            if (!existing || entity.relevanceScore > existing.relevanceScore) {
                entityMap.set(key, entity);
            }
        });

        const uniqueEntities = Array.from(entityMap.values())
            .sort((a, b) => b.relevanceScore - a.relevanceScore);

        return {
            entities: uniqueEntities,
            totalReports: reportsWithEntities.length,
            summary: {
                totalEntities: uniqueEntities.length,
                entityTypes: [...new Set(uniqueEntities.map(e => e.type))],
                topEntities: uniqueEntities.slice(0, 10).map(e => ({
                    type: e.type,
                    value: e.value,
                    relevanceScore: e.relevanceScore
                }))
            }
        };
    }, 'Failed to fetch entities');
} 