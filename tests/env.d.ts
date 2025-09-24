// Type definitions for Cloudflare Workers tests
import type { Env } from '../worker-configuration';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}