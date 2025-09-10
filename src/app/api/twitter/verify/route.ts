import { withErrorHandling } from '@/lib/api-utils';
import { TwitterService } from '@/lib/twitter-service';
import { OpenRouterImageService } from '@/lib/openrouter-image-service';

// GET /api/twitter/verify?mode=oauth1|oauth2
export async function GET(request: Request) {
  return withErrorHandling(async (env) => {
    const url = new URL(request.url);
    const mode = (url.searchParams.get('mode') || 'oauth1').toLowerCase();
    const imageService = new OpenRouterImageService(env);
    const svc = new TwitterService(env, imageService);

    if (mode === 'oauth2') {
      const result = await svc.verifyOAuth2();
      return {
        mode,
        ...result,
      };
    } else if (mode === 'oauth1') {
      const result = await svc.verifyOAuth1();
      return {
        mode,
        ...result,
      };
    } else {
      throw new Error('Invalid mode. Use oauth1 or oauth2');
    }
  }, 'Failed to verify Twitter credentials');
}

