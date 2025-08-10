// Performance monitoring for AI requests
interface PerformanceMetrics {
  requestCount: number;
  totalTime: number;
  averageTime: number;
  cacheHits: number;
  errors: number;
}

class AIPerformanceMonitor {
  private metrics: PerformanceMetrics = {
    requestCount: 0,
    totalTime: 0,
    averageTime: 0,
    cacheHits: 0,
    errors: 0,
  };

  startTimer(): () => number {
    const start = performance.now();
    return () => performance.now() - start;
  }

  recordRequest(duration: number, fromCache = false, error = false): void {
    this.metrics.requestCount++;
    
    if (error) {
      this.metrics.errors++;
      return;
    }

    if (fromCache) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.totalTime += duration;
    }

    this.metrics.averageTime = this.metrics.totalTime / (this.metrics.requestCount - this.metrics.cacheHits);
  }

  getMetrics(): PerformanceMetrics & { cacheHitRate: number } {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.requestCount > 0 
        ? (this.metrics.cacheHits / this.metrics.requestCount) * 100 
        : 0,
    };
  }

  reset(): void {
    this.metrics = {
      requestCount: 0,
      totalTime: 0,
      averageTime: 0,
      cacheHits: 0,
      errors: 0,
    };
  }

  logStats(): void {
    const stats = this.getMetrics();
    console.log("🔍 AI Performance Stats:", {
      "Total Requests": stats.requestCount,
      "Average Response Time": `${stats.averageTime.toFixed(0)}ms`,
      "Cache Hit Rate": `${stats.cacheHitRate.toFixed(1)}%`,
      "Error Rate": `${((stats.errors / stats.requestCount) * 100).toFixed(1)}%`,
    });
  }
}

export const aiPerformanceMonitor = new AIPerformanceMonitor();