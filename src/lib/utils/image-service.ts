import { Cloudflare } from '../../../worker-configuration';

export class ImageService {
    constructor(private env: Cloudflare.Env) { }

    async generateImage(headline: string): Promise<ArrayBuffer> {
        const url = `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/bytedance/stable-diffusion-xl-lightning`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.env.CLOUDFLARE_AI_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: headline })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to generate image: ${response.status} - ${error}`);
            }

            return await response.arrayBuffer();
        } catch (error) {
            console.error('[IMAGE] Image generation failed:', error);
            throw error;
        }
    }
} 