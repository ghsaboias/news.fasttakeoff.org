import { DiscordMessage, DiscordChannel } from '@/lib/types/discord';
import { Report } from '@/lib/types/reports';
import { ReportRow } from '@/lib/types/database';

/**
 * Service Interfaces - Contracts for dependency injection
 * These define what services can do, not how they do it
 */

export interface IMessagesService {
  getMessagesInTimeWindow(channelId: string, windowStart: Date, windowEnd: Date): Promise<DiscordMessage[]>;
  getLatestMessages(channelId: string, limit?: number): Promise<DiscordMessage[]>;
  updateMessages(): Promise<void>;
}

export interface IChannelsService {
  getChannelName(channelId: string): Promise<string>;
  getAllChannels(): Promise<DiscordChannel[]>;
  getActiveChannels(): Promise<DiscordChannel[]>;
  refreshChannelList(): Promise<DiscordChannel[]>;
}

export interface IReportService {
  createDynamicReport(channelId: string, windowStart: Date, windowEnd: Date): Promise<{ report: Report | null; messages: DiscordMessage[] }>;
  getReports(options?: { channelId?: string; limit?: number; offset?: number }): Promise<ReportRow[]>;
  getReportById(reportId: string): Promise<Report | null>;
}

export interface ISocialMediaService {
  postContent(content: string, options?: Record<string, unknown>): Promise<{ success: boolean; url?: string; error?: string }>;
}

export interface IInstagramService extends ISocialMediaService {
  createCarouselPost(report: Report): Promise<{ success: boolean; url?: string; error?: string }>;
}

export interface ITwitterService extends ISocialMediaService {
  createThread(report: Report): Promise<{ success: boolean; url?: string; error?: string }>;
}

export interface IFacebookService extends ISocialMediaService {
  createPost(report: Report): Promise<{ success: boolean; url?: string; error?: string }>;
}