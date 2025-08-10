"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface HealthStatus {
  redis: 'connected' | 'disconnected' | 'error';
  embedding: 'loaded' | 'loading' | 'error';
  cache: 'active' | 'inactive' | 'error';
}

export function CacheHealth() {
  const [health, setHealth] = useState<HealthStatus>({
    redis: 'disconnected',
    embedding: 'loading',
    cache: 'inactive'
  });
  const [loading, setLoading] = useState(true);

  const checkHealth = async () => {
    setLoading(true);
    
    try {
      // Check Redis connection via cache stats
      const statsResponse = await fetch('/api/cache-stats');
      const statsData = await statsResponse.json();
      
      const newHealth: HealthStatus = {
        redis: statsData.success ? 'connected' : 'error',
        embedding: 'loaded', // Assume loaded if we got this far
        cache: statsData.success && statsData.stats.totalEntries >= 0 ? 'active' : 'inactive'
      };
      
      setHealth(newHealth);
    } catch (error) {
      setHealth({
        redis: 'error',
        embedding: 'error',
        cache: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'loaded':
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'loading':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'disconnected':
      case 'inactive':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'loaded':
      case 'active':
        return 'default';
      case 'loading':
        return 'secondary';
      case 'disconnected':
      case 'inactive':
        return 'outline';
      default:
        return 'destructive';
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </CardContent>
      </Card>
    );
  }

  const allHealthy = Object.values(health).every(status => 
    ['connected', 'loaded', 'active'].includes(status)
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {allHealthy ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          )}
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(health.redis)}
            <span className="text-sm">Redis Connection</span>
          </div>
          <Badge variant={getStatusColor(health.redis) as any} className="text-xs">
            {health.redis}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(health.embedding)}
            <span className="text-sm">Embedding Model</span>
          </div>
          <Badge variant={getStatusColor(health.embedding) as any} className="text-xs">
            {health.embedding}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(health.cache)}
            <span className="text-sm">Semantic Cache</span>
          </div>
          <Badge variant={getStatusColor(health.cache) as any} className="text-xs">
            {health.cache}
          </Badge>
        </div>

        {allHealthy && (
          <div className="pt-2 border-t border-zinc-800">
            <p className="text-xs text-green-400 text-center">
              ⚡ All systems operational
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}