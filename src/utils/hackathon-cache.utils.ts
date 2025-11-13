interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  etag: string;
}

class HackathonCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly SINGLE_HACKATHON_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly LIST_TTL = 2 * 60 * 1000; // 2 minutes

  /**
   * Generate cache key for single hackathon
   */
  private getHackathonKey(slug: string): string {
    return `hackathon:${slug}`;
  }

  /**
   * Generate cache key for hackathon list
   */
  private getListKey(queryString: string): string {
    return `hackathons:${queryString}`;
  }

  /**
   * Generate ETag from data
   */
  private generateETag(data: any): string {
    const str = JSON.stringify(data);
    // Simple hash function for ETag
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `"${Math.abs(hash).toString(36)}"`;
  }

  /**
   * Get cached hackathon by slug
   */
  getHackathon(slug: string): { data: any; etag: string } | null {
    const key = this.getHackathonKey(slug);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return { data: entry.data, etag: entry.etag };
  }

  /**
   * Get cached hackathon list
   */
  getList(queryString: string): { data: any; etag: string } | null {
    const key = this.getListKey(queryString);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return { data: entry.data, etag: entry.etag };
  }

  /**
   * Set cached hackathon
   */
  setHackathon(slug: string, data: any): void {
    const key = this.getHackathonKey(slug);
    const etag = this.generateETag(data);
    const expiresAt = Date.now() + this.SINGLE_HACKATHON_TTL;

    this.cache.set(key, { data, expiresAt, etag });
  }

  /**
   * Set cached hackathon list
   */
  setList(queryString: string, data: any): void {
    const key = this.getListKey(queryString);
    const etag = this.generateETag(data);
    const expiresAt = Date.now() + this.LIST_TTL;

    this.cache.set(key, { data, expiresAt, etag });
  }

  /**
   * Invalidate cache for a specific hackathon
   */
  invalidateHackathon(slug: string): void {
    const key = this.getHackathonKey(slug);
    this.cache.delete(key);
    // Also invalidate all list caches
    this.invalidateAllLists();
  }

  /**
   * Invalidate all list caches
   */
  invalidateAllLists(): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith("hackathons:")) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }
}

// Singleton instance
export const hackathonCache = new HackathonCache();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      hackathonCache.cleanup();
    },
    5 * 60 * 1000,
  );
}
