"use client";

import { useState } from "react";
import { CacheMonitor } from "@/components/cache-monitor";
import { CacheHealth } from "@/components/cache-health";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Zap, Clock, Database } from "lucide-react";

export default function CacheDemoPage() {
  const [testCode, setTestCode] = useState(`function calculateSum(a: number, b: number): number {
  return a + b;
}

const result = calculateSum(5, 3);
console.log(result);`);
  
  const [suggestion, setSuggestion] = useState("");
  const [chatResponse, setChatResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [chatResponseTime, setChatResponseTime] = useState<number | null>(null);
  const [cached, setCached] = useState(false);
  const [chatCached, setChatCached] = useState(false);
  const [testMessage, setTestMessage] = useState("How do I optimize React performance?");

  const testSuggestion = async () => {
    setLoading(true);
    setSuggestion("");
    setResponseTime(null);
    setCached(false);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch('/api/code-suggestion/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileContent: testCode,
          cursorLine: 4,
          cursorColumn: 20,
          suggestionType: 'completion',
          fileName: 'test.ts'
        })
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      let fullSuggestion = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                fullSuggestion += data.chunk;
                setSuggestion(fullSuggestion);
              }
              if (data.done) {
                setResponseTime(data.responseTime || Date.now() - startTime);
                setCached(data.cached || false);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Suggestion test failed:', error);
      setSuggestion("Error: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const testChatResponse = async () => {
    setChatLoading(true);
    setChatResponse("");
    setChatResponseTime(null);
    setChatCached(false);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testMessage,
          history: [],
          mode: 'chat'
        })
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      let fullResponse = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                fullResponse += data.chunk;
                setChatResponse(fullResponse);
              }
              if (data.done) {
                setChatResponseTime(data.responseTime || Date.now() - startTime);
                setChatCached(data.cached || false);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat test failed:', error);
      setChatResponse("Error: " + (error as Error).message);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Redis Semantic Cache Demo</h1>
        <p className="text-zinc-400">
          Test the performance improvement from semantic caching
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Status */}
        <CacheHealth />
        
        {/* Cache Monitor */}
        <CacheMonitor />
        
        {/* Performance Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {responseTime && (
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {responseTime}ms
                </div>
                <div className="text-sm text-zinc-500">Response Time</div>
                {cached && (
                  <Badge className="mt-2" variant="default">
                    <Zap className="h-3 w-3 mr-1" />
                    Cached
                  </Badge>
                )}
              </div>
            )}
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Model:</span>
                <span className="text-green-400">CodeLlama 7B</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Expected without cache:</span>
                <span>2000-3000ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">With cache:</span>
                <span className="text-green-400">50-100ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Improvement:</span>
                <span className="text-green-400">95%+ faster</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Testing Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chat Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💬 AI Chat Cache Test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              rows={3}
              className="font-mono text-sm"
              placeholder="Enter your chat message here..."
            />
            <Button 
              onClick={testChatResponse} 
              disabled={chatLoading}
              className="w-full"
            >
              {chatLoading ? 'Getting AI Response...' : 'Test Chat Response'}
            </Button>
            
            {chatResponse && (
              <div className="space-y-3">
                <div className="bg-zinc-900 p-4 rounded-lg max-h-40 overflow-y-auto">
                  <pre className="text-sm text-blue-400 whitespace-pre-wrap">
                    {chatResponse}
                  </pre>
                </div>
                {chatResponseTime && (
                  <div className="flex items-center gap-4 text-sm">
                    <Badge variant={chatCached ? "default" : "secondary"}>
                      {chatCached ? "Cache Hit" : "Cache Miss"}
                    </Badge>
                    <span className="text-zinc-400">
                      Response: {chatResponseTime}ms
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Code Testing Area */}
        <Card>
          <CardHeader>
            <CardTitle>💻 Code Suggestion Cache Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              rows={10}
              className="font-mono text-sm"
              placeholder="Enter your test code here..."
            />
            <Button 
              onClick={testSuggestion} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Generating Suggestion...' : 'Test Code Suggestion'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Code Suggestion Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            {suggestion ? (
              <div className="space-y-3">
                <div className="bg-zinc-900 p-4 rounded-lg">
                  <pre className="text-sm text-green-400 whitespace-pre-wrap">
                    {suggestion}
                  </pre>
                </div>
                {responseTime && (
                  <div className="flex items-center gap-4 text-sm">
                    <Badge variant={cached ? "default" : "secondary"}>
                      {cached ? "Cache Hit" : "Cache Miss"}
                    </Badge>
                    <span className="text-zinc-400">
                      Response: {responseTime}ms
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-zinc-500 py-8">
                Click "Test Code Suggestion" to see AI response
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Test Cache Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-2">
              <div className="font-medium text-blue-400">1. First Run</div>
              <p className="text-zinc-400">
                Test both code and chat - will be slow (2-3s) as it calls Ollama
              </p>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-green-400">2. Second Run</div>
              <p className="text-zinc-400">
                Same requests should be instant (50ms) from Redis cache
              </p>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-purple-400">3. Monitor</div>
              <p className="text-zinc-400">
                Watch cache stats update with both code and chat entries
              </p>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-orange-400">4. Verify</div>
              <p className="text-zinc-400">
                Check console logs for cache hits/misses and performance
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}