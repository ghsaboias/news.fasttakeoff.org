import { Cloudflare } from '../../../worker-configuration';
import { MessagesService } from '../data/messages-service';
import { ChannelsService } from '../data/channels-service';
import { ReportService } from '../data/report-service';
import { InstagramService } from '../instagram-service';
import { FacebookService } from '../facebook-service';
import { TwitterService } from '../twitter-service';
import { CacheManager } from '../cache-utils';
import { OpenRouterImageService } from '../openrouter-image-service';

/**
 * ServiceFactory - Centralized service creation and management
 * Implements singleton pattern for expensive services
 */
export class ServiceFactory {
  private static instance: ServiceFactory | null = null;
  
  // Singleton service instances
  private messagesService: MessagesService | null = null;
  private instagramService: InstagramService | null = null;
  private facebookService: FacebookService | null = null;
  private twitterService: TwitterService | null = null;
  private cacheManager: CacheManager | null = null;
  private openRouterImageService: OpenRouterImageService | null = null;

  constructor(private env: Cloudflare.Env) {}

  /**
   * Get singleton factory instance
   */
  static getInstance(env: Cloudflare.Env): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory(env);
    }
    return ServiceFactory.instance;
  }

  /**
   * Get or create MessagesService singleton
   */
  getMessagesService(): MessagesService {
    if (!this.messagesService) {
      this.messagesService = new MessagesService(
        this.getCacheManager(),
        this.createChannelsService(),
        this.env
      );
    }
    return this.messagesService;
  }

  /**
   * Create new ChannelsService instance (not singleton due to mutable state)
   */
  createChannelsService(): ChannelsService {
    return new ChannelsService(
      this.getCacheManager(),
      this.env
    );
  }

  /**
   * Get or create InstagramService singleton
   */
  getInstagramService(): InstagramService {
    if (!this.instagramService) {
      this.instagramService = new InstagramService(this.env, this.getOpenRouterImageService());
    }
    return this.instagramService;
  }

  /**
   * Get or create FacebookService singleton
   */
  getFacebookService(): FacebookService {
    if (!this.facebookService) {
      this.facebookService = new FacebookService(this.env);
    }
    return this.facebookService;
  }

  /**
   * Get or create TwitterService singleton
   */
  getTwitterService(): TwitterService {
    if (!this.twitterService) {
      this.twitterService = new TwitterService(this.env, this.getOpenRouterImageService());
    }
    return this.twitterService;
  }

  /**
   * Get or create CacheManager singleton
   */
  getCacheManager(): CacheManager {
    if (!this.cacheManager) {
      this.cacheManager = new CacheManager(this.env);
    }
    return this.cacheManager;
  }

  /**
   * Get or create OpenRouterImageService singleton
   */
  getOpenRouterImageService(): OpenRouterImageService {
    if (!this.openRouterImageService) {
      this.openRouterImageService = new OpenRouterImageService(this.env);
    }
    return this.openRouterImageService;
  }

  /**
   * Create ReportService with all dependencies injected
   * Note: ReportService itself is NOT a singleton - create new instances as needed
   */
  createReportService(): ReportService {
    return new ReportService(
      this.getMessagesService(),
      this.createChannelsService(),
      this.getInstagramService(),
      this.getFacebookService(),
      this.getTwitterService(),
      this.getCacheManager(),
      this.env
    );
  }

  /**
   * Clear all singletons (useful for testing)
   */
  static reset(): void {
    ServiceFactory.instance = null;
  }
}