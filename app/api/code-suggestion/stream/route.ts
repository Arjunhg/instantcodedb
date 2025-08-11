import { type NextRequest } from "next/server"
import { semanticCache } from "@/lib/semantic-cache"

// Helper functions (copied from non-streaming version)
function analyzeCodeContext(content: string, line: number, column: number, fileName?: string) {
  const lines = content.split("\n")
  const currentLine = lines[line] || ""

  // Get surrounding context (10 lines before and after)
  const contextRadius = 10
  const startLine = Math.max(0, line - contextRadius)
  const endLine = Math.min(lines.length, line + contextRadius)

  const beforeContext = lines.slice(startLine, line).join("\n")
  const afterContext = lines.slice(line + 1, endLine).join("\n")

  // Detect language and framework
  const language = detectLanguage(content, fileName)
  const framework = detectFramework(content)

  // Analyze code patterns
  const isInFunction = detectInFunction(lines, line)
  const isInClass = detectInClass(lines, line)
  const isAfterComment = detectAfterComment(currentLine, column)
  const incompletePatterns = detectIncompletePatterns(currentLine, column)

  return {
    language,
    framework,
    beforeContext,
    currentLine,
    afterContext,
    cursorPosition: { line, column },
    isInFunction,
    isInClass,
    isAfterComment,
    incompletePatterns,
  }
}

function detectLanguage(content: string, fileName?: string): string {
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase()
    const extMap: Record<string, string> = {
      ts: "TypeScript",
      tsx: "TypeScript",
      js: "JavaScript",
      jsx: "JavaScript",
      py: "Python",
      java: "Java",
      go: "Go",
      rs: "Rust",
      php: "PHP",
    }
    if (ext && extMap[ext]) return extMap[ext]
  }

  // Content-based detection
  if (content.includes("interface ") || content.includes(": string")) return "TypeScript"
  if (content.includes("import React") || content.includes("useState")) return "JavaScript"
  if (content.includes("def ") || content.includes("import ")) return "Python"
  if (content.includes("func ") || content.includes("package ")) return "Go"

  return "JavaScript"
}

function detectFramework(content: string): string {
  if (content.includes("import React") || content.includes("useState")) return "React"
  if (content.includes("import Vue") || content.includes("<template>")) return "Vue"
  if (content.includes("@angular/") || content.includes("@Component")) return "Angular"
  if (content.includes("next/") || content.includes("getServerSideProps")) return "Next.js"

  return "None"
}

function detectInFunction(lines: string[], currentLine: number): boolean {
  for (let i = currentLine - 1; i >= 0; i--) {
    const line = lines[i]
    if (line?.match(/^\s*(function|def|const\s+\w+\s*=|let\s+\w+\s*=)/)) return true
    if (line?.match(/^\s*}/)) break
  }
  return false
}

function detectInClass(lines: string[], currentLine: number): boolean {
  for (let i = currentLine - 1; i >= 0; i--) {
    const line = lines[i]
    if (line?.match(/^\s*(class|interface)\s+/)) return true
  }
  return false
}

function detectAfterComment(line: string, column: number): boolean {
  const beforeCursor = line.substring(0, column)
  return /\/\/.*$/.test(beforeCursor) || /#.*$/.test(beforeCursor)
}

function detectIncompletePatterns(line: string, column: number): string[] {
  const beforeCursor = line.substring(0, column)
  const patterns: string[] = []

  if (/^\s*(if|while|for)\s*\($/.test(beforeCursor.trim())) patterns.push("conditional")
  if (/^\s*(function|def)\s*$/.test(beforeCursor.trim())) patterns.push("function")
  if (/\{\s*$/.test(beforeCursor)) patterns.push("object")
  if (/\[\s*$/.test(beforeCursor)) patterns.push("array")
  if (/=\s*$/.test(beforeCursor)) patterns.push("assignment")
  if (/\.\s*$/.test(beforeCursor)) patterns.push("method-call")

  return patterns
}

// Helper function to extract imports from code
function extractImports(code: string): string {
  const lines = code.split('\n');
  const imports = lines.filter(line => 
    line.trim().startsWith('import ') || 
    line.trim().startsWith('from ') ||
    line.trim().startsWith('const ') && line.includes('require(') ||
    line.trim().startsWith('#include') ||
    line.trim().startsWith('using ')
  );
  return imports.slice(0, 5).join('\n'); // Limit to 5 most recent imports
}

// Helper function to extract current function context
function extractFunctionContext(beforeContext: string, cursorLine: number): string {
  const lines = beforeContext.split('\n');
  let functionStart = -1;
  
  // Find the start of current function
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.match(/^\s*(function|def|const\s+\w+\s*=|let\s+\w+\s*=|class\s+|interface\s+)/)) {
      functionStart = i;
      break;
    }
  }
  
  if (functionStart >= 0) {
    return lines.slice(Math.max(0, functionStart - 2), lines.length).join('\n');
  }
  
  // If no function found, return last 8 lines
  return lines.slice(-8).join('\n');
}

// Helper function to detect useState patterns
function detectReactPatterns(beforeContext: string): boolean {
  return beforeContext.includes('useState') || 
         beforeContext.includes('useEffect') || 
         beforeContext.includes('import React');
}

// Helper function to create completion-focused prompt
function buildPrompt(context: any, suggestionType: string): string {
  const { beforeContext, currentLine, afterContext, cursorPosition, language, framework, isAfterComment } = context;
  
  // Extract relevant context
  const imports = extractImports(beforeContext);
  const functionContext = extractFunctionContext(beforeContext, cursorPosition.line);
  
  // Get the line up to cursor
  const lineBeforeCursor = currentLine.substring(0, cursorPosition.column);
  const lineAfterCursor = currentLine.substring(cursorPosition.column);
  
  // Special handling for comments that indicate code requests
  if (isAfterComment) {
    const commentText = lineBeforeCursor.toLowerCase();
    
    // Check if comment is requesting code
    const codeRequestPatterns = [
      'add', 'create', 'build', 'make', 'implement',
      'component', 'function', 'class', 'method',
      'navbar', 'button', 'form', 'modal', 'card',
      'tailwind', 'css', 'style', 'react', 'jsx'
    ];
    
    const isCodeRequest = codeRequestPatterns.some(pattern => 
      commentText.includes(pattern)
    );
    
    if (isCodeRequest && (language === 'JavaScript' || language === 'TypeScript')) {
      // Generate appropriate code based on context and comment
      return `You are a code completion AI. The user has written a comment requesting code implementation.

Context:
- Language: ${language}
- Framework: ${framework}
- Comment: "${lineBeforeCursor.trim()}"

${imports ? `Imports:\n${imports}\n` : ''}

Current function context:
${functionContext}

IMPORTANT: Generate ONLY the actual code that should come after the comment, not explanations. 
Start writing code immediately. If it's a React component request, write JSX. 
If it's a function request, write the function. Be concise and practical.

Complete this code:
${lineBeforeCursor}`;
    }
  }
  
  // For React/JavaScript useState patterns
  if (language === 'TypeScript' || language === 'JavaScript') {
    if (detectReactPatterns(beforeContext) && lineBeforeCursor.includes('useState')) {
      return `${imports}

${functionContext}
${lineBeforeCursor}`;
    }
    
    // For JSX/component creation - detect JSX context
    if (lineBeforeCursor.includes('return (') || 
        lineBeforeCursor.includes('<') ||
        beforeContext.includes('return (')) {
      return `${imports}

${functionContext}
${lineBeforeCursor}`;
    }
    
    // For general React patterns
    if (detectReactPatterns(beforeContext)) {
      return `${imports}

${functionContext}
${lineBeforeCursor}`;
    }
  }
  
  // For general code completion - use Fill-in-the-Middle approach
  if (afterContext.trim()) {
    return `${imports}

${functionContext}
${lineBeforeCursor}`;
  }
  
  // Simple completion without suffix
  return `${imports}

${functionContext}
${lineBeforeCursor}`;
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  
  try {
    const body = await request.json()
    const { fileContent, cursorLine, cursorColumn, suggestionType, fileName } = body

    // Validate input
    if (!fileContent || cursorLine < 0 || cursorColumn < 0 || !suggestionType) {
      return new Response(
        JSON.stringify({ error: "Invalid input parameters" }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Analyze code context (like non-streaming version)
    const context = analyzeCodeContext(fileContent, cursorLine, cursorColumn, fileName)

    console.log("🚀 Streaming API - Analyzed context:", {
      language: context.language,
      framework: context.framework,
      isInFunction: context.isInFunction,
      incompletePatterns: context.incompletePatterns
    })

    // 🎯 SEMANTIC CACHE LOOKUP
    const cacheInput = {
      fileContent,
      cursorLine,
      cursorColumn,
      language: context.language,
      framework: context.framework,
      suggestionType
    };

    const cachedSuggestion = await semanticCache.getCachedSuggestion(cacheInput);
    
    if (cachedSuggestion) {
      // Return cached result as a stream for consistency
      const responseTime = Date.now() - requestStartTime;
      console.log(`⚡ CACHE HIT - Total response time: ${responseTime}ms`);
      
      const stream = new ReadableStream({
        start(controller) {
          // Send the cached suggestion immediately
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ 
              chunk: cachedSuggestion,
              done: false,
              cached: true,
              responseTime
            })}\n\n`)
          );
          
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ 
              done: true,
              cached: true,
              responseTime
            })}\n\n`)
          );
          
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Build AI prompt (like non-streaming version)
    const prompt = buildPrompt(context, suggestionType)

    // 🤖 CACHE MISS - Generate new suggestion
    console.log("🤖 CACHE MISS - Generating new suggestion with Ollama...");
    let fullSuggestion = "";

    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "codellama:latest", // Better for code completion
              prompt,
              stream: true,
              options: {
                temperature: 0.05,      // Very low temperature for precise completions
                top_p: 0.85,           // Focus on most likely tokens
                num_predict: 200,      // Allow longer completions for JSX
                num_ctx: 4096,         // Larger context window
                repeat_penalty: 1.05,  // Slight penalty for repetition
                stop: [
                  "\n\nexport",        // Stop at next export
                  "\n\nfunction",      // Stop at next function
                  "\n\nconst",         // Stop at next const declaration
                  "\n\nimport",        // Stop at next import
                  "```",               // Stop at code blocks
                  "//",
                  "/*",
                  "import React",
                  "import {",
                  "function ",
                  "export ",
                  "</html>",           // Stop at HTML closing
                  "Here's",            // Stop at explanations
                  "This is",           // Stop at explanations
                  "The above",         // Stop at explanations
                  "Example:",          // Stop at examples
                ],
              },
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error("No reader available");
          }

          let buffer = "";
          let isFirstChunk = true;
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += new TextDecoder().decode(value);
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";
            
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const data = JSON.parse(line);
                  if (data.response) {
                    let cleanChunk = data.response;
                    
                    // Remove FIM markers if present
                    cleanChunk = cleanChunk.replace(/<fim_middle>/g, '');
                    cleanChunk = cleanChunk.replace(/<fim_prefix>/g, '');
                    cleanChunk = cleanChunk.replace(/<fim_suffix>/g, '');
                    
                    // For the first chunk, aggressively filter explanatory content
                    if (isFirstChunk) {
                      // Remove common AI explanation starters
                      cleanChunk = cleanChunk.replace(/^(Sure!?|Here'?s?|Here is|Let me|I'll|I can|This is|The completion|You can|To create|To add)/i, '');
                      
                      // If the entire first chunk is explanatory, skip it
                      const explanatoryFirstChunk = /^(an example of|how you can|a simple|the way to)/i;
                      if (explanatoryFirstChunk.test(cleanChunk.trim())) {
                        continue;
                      }
                      
                      isFirstChunk = false;
                    }
                    
                    // Skip chunks that are clearly explanatory text
                    const explanatoryPatterns = [
                      /^(an? example of|how you can|this (?:is|will)|using tailwind)/i,
                      /^(to (?:create|add|make|build)|the (?:above|following))/i,
                      /^(in this|for this|with this)/i
                    ];
                    
                    const isExplanatory = explanatoryPatterns.some(pattern => 
                      pattern.test(cleanChunk.trim())
                    );
                    
                    // Skip explanatory chunks entirely
                    if (isExplanatory) {
                      continue;
                    }
                    
                    // Send valid code chunks
                    if (cleanChunk !== '') {
                      fullSuggestion += cleanChunk;
                      
                      controller.enqueue(
                        new TextEncoder().encode(`data: ${JSON.stringify({ 
                          chunk: cleanChunk,
                          done: data.done || false,
                          cached: false
                        })}\n\n`)
                      );
                    }
                  }
                } catch (e) {
                  // Skip invalid JSON lines
                }
              }
            }
          }
          
          // 💾 Cache the complete suggestion with post-processing
          if (fullSuggestion.trim()) {
            // Clean up the final suggestion
            let cleanedSuggestion = fullSuggestion.trim();
            
            // Remove duplicate imports (common issue with CodeLlama)
            const lines = cleanedSuggestion.split('\n');
            const seenImports = new Set();
            const filteredLines = lines.filter(line => {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('import ')) {
                if (seenImports.has(trimmedLine)) {
                  return false; // Skip duplicate import
                }
                seenImports.add(trimmedLine);
              }
              return true;
            });
            
            cleanedSuggestion = filteredLines.join('\n').trim();
            
            console.log("💾 Caching new suggestion...");
            await semanticCache.cacheSuggestion(cacheInput, cleanedSuggestion);
          }
          
          const totalResponseTime = Date.now() - requestStartTime;
          console.log(`🤖 OLLAMA RESPONSE - Total time: ${totalResponseTime}ms`);
          
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ 
              done: true,
              cached: false,
              responseTime: totalResponseTime
            })}\n\n`)
          );
          controller.close();
          
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("Streaming error:", error);
    return new Response(
      JSON.stringify({ error: "Streaming failed" }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}