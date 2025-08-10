import { getRedisClient } from './redis-client';
import { generateEmbedding, createCodeContext, createChatContext, calculateSimilarity } from './embedding-service';

interface CacheEntry {
  id: string;
  context: string;
  embedding: number[];
  suggestion: string;
  language: string;
  framework: string;
  timestamp: number;
  hitCount: number;
}

interface CodeContextInput {
  fileContent: string;
  cursorLine: number;
  cursorColumn: number;
  language: string;
  framework: string;
  suggestionType: string;
}

export class SemanticCache {
  private readonly CACHE_PREFIX = 'code_suggestion:';
  private readonly SIMILARITY_THRESHOLD = 0.85; // High threshold for code similarity
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CACHE_TTL = 7 * 24 * 60 * 60; // 7 days

  async getCachedSuggestion(input: CodeContextInput): Promise<string | null> {
    const startTime = Date.now();
    
    try {
      const redis = await getRedisClient();
      
      // Create appropriate context based on type
      let context: string;
      if (input.language === "Chat") {
        // For chat messages, use chat context
        context = createChatContext(input.fileContent, input.framework, []);
      } else {
        // For code suggestions, use code context
        context = createCodeContext(
          input.fileContent,
          input.cursorLine,
          input.cursorColumn,
          input.language,
          input.framework
        );
      }

      console.log('🔍 Searching semantic cache...');
      
      // Generate embedding for the current context
      const queryEmbedding = await generateEmbedding(context);
      
      // Get all cache entries for this language/framework
      const pattern = `${this.CACHE_PREFIX}${input.language}:${input.framework}:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length === 0) {
        console.log('📭 No cache entries found');
        return null;
      }

      console.log(`🔎 Checking ${keys.length} cache entries for similarity`);
      
      let bestMatch: { key: string; similarity: number; entry: CacheEntry } | null = null;
      
      // Check similarity with all cached entries
      for (const key of keys) {
        const cachedData = await redis.get(key);
        if (!cachedData) continue;
        
        try {
          const entry: CacheEntry = JSON.parse(cachedData);
          const similarity = calculateSimilarity(queryEmbedding, entry.embedding);
          
          if (similarity > this.SIMILARITY_THRESHOLD && 
              (!bestMatch || similarity > bestMatch.similarity)) {
            bestMatch = { key, similarity, entry };
          }
        } catch (error) {
          console.error('Error parsing cache entry:', error);
        }
      }
      
      if (bestMatch) {
        // Update hit count and return cached suggestion
        bestMatch.entry.hitCount++;
        bestMatch.entry.timestamp = Date.now();
        
        await redis.setEx(
          bestMatch.key, 
          this.CACHE_TTL, 
          JSON.stringify(bestMatch.entry)
        );
        
        const responseTime = Date.now() - startTime;
        console.log(`🎯 Cache HIT! Similarity: ${(bestMatch.similarity * 100).toFixed(1)}%, Response time: ${responseTime}ms`);
        
        return bestMatch.entry.suggestion;
      }
      
      const responseTime = Date.now() - startTime;
      console.log(`❌ Cache MISS. Response time: ${responseTime}ms`);
      return null;
      
    } catch (error) {
      console.error('Error in semantic cache lookup:', error);
      return null;
    }
  }

  async cacheSuggestion(input: CodeContextInput, suggestion: string): Promise<void> {
    try {
      const redis = await getRedisClient();
      
      // Create appropriate context based on type
      let context: string;
      if (input.language === "Chat") {
        // For chat messages, use chat context
        context = createChatContext(input.fileContent, input.framework, []);
      } else {
        // For code suggestions, use code context
        context = createCodeContext(
          input.fileContent,
          input.cursorLine,
          input.cursorColumn,
          input.language,
          input.framework
        );
      }

      console.log('💾 Caching new suggestion...');
      
      // Generate embedding for the context
      const embedding = await generateEmbedding(context);
      
      // Create cache entry
      const entry: CacheEntry = {
        id: this.generateCacheId(input),
        context,
        embedding,
        suggestion: suggestion.trim(),
        language: input.language,
        framework: input.framework,
        timestamp: Date.now(),
        hitCount: 0
      };
      
      // Store in Redis with TTL
      const key = `${this.CACHE_PREFIX}${input.language}:${input.framework}:${entry.id}`;
      await redis.setEx(key, this.CACHE_TTL, JSON.stringify(entry));
      
      console.log(`✅ Cached suggestion with key: ${key}`);
      
      // Cleanup old entries if cache is getting too large
      await this.cleanupOldEntries(redis);
      
    } catch (error) {
      console.error('Error caching suggestion:', error);
    }
  }

  private generateCacheId(input: CodeContextInput): string {
    const hash = this.simpleHash(
      input.fileContent.substring(
        Math.max(0, input.cursorLine - 2), 
        input.cursorLine + 3
      ) + input.suggestionType
    );
    return `${Date.now()}_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private async cleanupOldEntries(redis: any): Promise<void> {
    try {
      const allKeys = await redis.keys(`${this.CACHE_PREFIX}*`);
      
      if (allKeys.length <= this.MAX_CACHE_SIZE) return;
      
      console.log(`🧹 Cleaning up cache (${allKeys.length} entries)`);
      
      // Get all entries with timestamps
      const entries: { key: string; timestamp: number; hitCount: number }[] = [];
      
      for (const key of allKeys) {
        const data = await redis.get(key);
        if (data) {
          try {
            const entry = JSON.parse(data);
            entries.push({
              key,
              timestamp: entry.timestamp || 0,
              hitCount: entry.hitCount || 0
            });
          } catch (error) {
            // Delete corrupted entries
            await redis.del(key);
          }
        }
      }
      
      // Sort by hit count (ascending) then by timestamp (ascending)
      entries.sort((a, b) => {
        if (a.hitCount !== b.hitCount) {
          return a.hitCount - b.hitCount;
        }
        return a.timestamp - b.timestamp;
      });
      
      // Delete oldest/least used entries
      const toDelete = entries.slice(0, entries.length - this.MAX_CACHE_SIZE + 100);
      if (toDelete.length > 0) {
        await redis.del(toDelete.map(e => e.key));
        console.log(`🗑️ Deleted ${toDelete.length} old cache entries`);
      }
      
    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }

  async getCacheStats(): Promise<{
    totalEntries: number;
    entriesByLanguage: Record<string, number>;
    oldestEntry: number;
    newestEntry: number;
  }> {
    try {
      const redis = await getRedisClient();
      const allKeys = await redis.keys(`${this.CACHE_PREFIX}*`);
      
      const stats = {
        totalEntries: allKeys.length,
        entriesByLanguage: {} as Record<string, number>,
        oldestEntry: Date.now(),
        newestEntry: 0
      };
      
      for (const key of allKeys) {
        const data = await redis.get(key);
        if (data) {
          try {
            const entry = JSON.parse(data);
            stats.entriesByLanguage[entry.language] = 
              (stats.entriesByLanguage[entry.language] || 0) + 1;
            
            if (entry.timestamp < stats.oldestEntry) {
              stats.oldestEntry = entry.timestamp;
            }
            if (entry.timestamp > stats.newestEntry) {
              stats.newestEntry = entry.timestamp;
            }
          } catch (error) {
            // Skip corrupted entries
          }
        }
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalEntries: 0,
        entriesByLanguage: {},
        oldestEntry: 0,
        newestEntry: 0
      };
    }
  }
}

// Singleton instance
export const semanticCache = new SemanticCache();