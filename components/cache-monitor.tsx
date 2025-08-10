"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, 
  Database, 
  Clock, 
  Zap, 
  TrendingUp,
  RefreshCw 
} from "lucide-react";

interface CacheStats {
  totalEntries: number;
  entriesByLanguage: Record<string, number>;
  oldestEntryAge: number;
  newestEntryAge: number;
}

interface TestResult {
  testCase: string;
  cached: boolean;
  responseTime: number;
  suggestion: string;
}

export function CacheMonitor() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/cache-stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      } else {
        setError(data.error || 'Failed to fetch stats');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error fetching cache stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const testCachePerformance = async () => {
    setTesting(true);
    try {
      // First populate cache
      await fetch('/api/test-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'populate' })
      });

      // Then test performance
      const response = await fetch('/api/test-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' })
      });
      
      const data = await response.json();
      if (data.success) {
        setTestResults(data.results);
      }
    } catch (err) {
      console.error('Cache test failed:', err);
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatAge = (ms: number) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  };

  if (error) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-500">
            <Database className="h-5 w-5" />
            Cache Monitor - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <Button onClick={fetchStats} size="sm" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-500" />
            Redis Cache
          </div>
          <Button 
            onClick={fetchStats} 
            size="sm" 
            variant="ghost"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats ? (
          <>
            {/* Total Entries */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Total Entries</span>
              </div>
              <Badge variant="secondary">{stats.totalEntries}</Badge>
            </div>

            {/* Cache Age */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Cache Age</span>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500">
                  Oldest: {formatAge(stats.oldestEntryAge)}
                </div>
                <div className="text-xs text-zinc-500">
                  Newest: {formatAge(stats.newestEntryAge)}
                </div>
              </div>
            </div>

            {/* Languages & Types */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Cache Types</span>
              </div>
              <div className="space-y-1">
                {Object.entries(stats.entriesByLanguage).map(([lang, count]) => (
                  <div key={lang} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">
                      {lang === "Chat" ? "💬 AI Chat" : `💻 ${lang}`}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Test */}
            <div className="pt-2 border-t border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Performance Test</span>
                </div>
                <Button 
                  onClick={testCachePerformance} 
                  size="sm" 
                  variant="outline"
                  disabled={testing}
                >
                  {testing ? 'Testing...' : 'Test Cache'}
                </Button>
              </div>
              
              {testResults.length > 0 && (
                <div className="space-y-1">
                  {testResults.map((result, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">{result.testCase}</span>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={result.cached ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {result.responseTime}ms
                        </Badge>
                        {result.cached && (
                          <span className="text-green-400 text-xs">✓</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-zinc-500 mt-2">
                Semantic caching reduces response time by 95%
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}