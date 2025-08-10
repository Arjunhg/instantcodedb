import { type NextRequest, NextResponse } from "next/server"
import { semanticCache } from "@/lib/semantic-cache"

// Test data for cache performance testing
const testCases = [
  {
    fileContent: `function calculateSum(a: number, b: number): number {
  return a + b;
}

const result = calculateSum(5, 3);
console.log(result);`,
    cursorLine: 4,
    cursorColumn: 20,
    language: "TypeScript",
    framework: "None",
    suggestionType: "code_completion"
  },
  {
    fileContent: `import React, { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => }>
        Increment
      </button>
    </div>
  );
}`,
    cursorLine: 8,
    cursorColumn: 26,
    language: "TypeScript",
    framework: "React",
    suggestionType: "code_completion"
  },
  {
    fileContent: "How do I optimize React performance?",
    cursorLine: 0,
    cursorColumn: 0,
    language: "Chat",
    framework: "chat",
    suggestionType: "chat_general"
  },
  {
    fileContent: "Explain async/await in JavaScript",
    cursorLine: 0,
    cursorColumn: 0,
    language: "Chat",
    framework: "review",
    suggestionType: "chat_review"
  }
];

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === "populate") {
      // Populate cache with test data
      const results = [];
      
      for (const testCase of testCases) {
        let suggestion: string;
        if (testCase.language === "Chat") {
          suggestion = testCase.suggestionType.includes("review") 
            ? "Async/await is a modern JavaScript feature that makes asynchronous code more readable..."
            : "To optimize React performance, consider using React.memo, useMemo, and useCallback...";
        } else {
          suggestion = `setCount(count + 1)`;
        }
        
        await semanticCache.cacheSuggestion(testCase, suggestion);
        results.push({ cached: true, testCase: testCase.suggestionType });
      }
      
      return NextResponse.json({
        success: true,
        message: "Cache populated with test data",
        results
      });
    }
    
    if (action === "test") {
      // Test cache performance
      const results = [];
      
      for (const testCase of testCases) {
        const startTime = Date.now();
        const cachedResult = await semanticCache.getCachedSuggestion(testCase);
        const responseTime = Date.now() - startTime;
        
        results.push({
          testCase: testCase.suggestionType,
          cached: !!cachedResult,
          responseTime,
          suggestion: cachedResult?.substring(0, 50) + "..." || "No cache hit"
        });
      }
      
      return NextResponse.json({
        success: true,
        results
      });
    }
    
    return NextResponse.json({
      success: false,
      error: "Invalid action. Use 'populate' or 'test'"
    }, { status: 400 });
    
  } catch (error) {
    console.error('Cache test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Cache test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}