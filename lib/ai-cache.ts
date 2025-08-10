// Simple in-memory cache for AI responses
interface CacheEntry {
  response: string;
  timestamp: number;
  ttl: number;
}

class AICache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  private generateKey(prompt: string, model: string): string {
    // Create a hash-like key from prompt and model
    return `${model}:${prompt.slice(0, 100)}:${prompt.length}`;
  }

  set(prompt: string, model: string, response: string, ttl?: number): void {
    const key = this.generateKey(prompt, model);
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
    });

    // Clean up expired entries periodically
    if (this.cache.size > 100) {
      this.cleanup();
    }
  }

  get(prompt: string, model: string): string | null {
    const key = this.generateKey(prompt, model);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.response;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const aiCache = new AICache();