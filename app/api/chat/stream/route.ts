import { type NextRequest } from "next/server";
import { semanticCache } from "@/lib/semantic-cache";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();

  try {
    const body = await request.json();
    const { message, history, mode } = body;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required and must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate and prepare history
    const validHistory = Array.isArray(history)
      ? history.filter(
          (msg: any) =>
            msg &&
            typeof msg === "object" &&
            typeof msg.role === "string" &&
            typeof msg.content === "string" &&
            ["user", "assistant"].includes(msg.role)
        )
      : [];

    const recentHistory = validHistory.slice(-10);

    // Build system prompt based on mode
    const getSystemPrompt = (mode: string) => {
      switch (mode) {
        case "review":
          return `You are an expert code reviewer. Provide detailed, constructive feedback on code quality, performance, security, and best practices. Be specific and actionable in your suggestions.`;
        case "fix":
          return `You are a debugging expert. Help identify and fix bugs, errors, and issues in code. Provide clear explanations and working solutions.`;
        case "optimize":
          return `You are a performance optimization expert. Analyze code for performance bottlenecks and suggest specific improvements for speed, memory usage, and efficiency.`;
        default:
          return `You are an expert AI coding assistant. Help developers with code explanations, debugging, best practices, architecture advice, and writing clean, efficient code. Always provide clear, practical answers with proper code formatting.`;
      }
    };

    const systemPrompt = getSystemPrompt(mode || "chat");
    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...recentHistory,
      { role: "user", content: message },
    ];

    const prompt = fullMessages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n\n");

    // 🎯 SEMANTIC CACHE LOOKUP for AI Chat
    const cacheInput = {
      fileContent: message, // Use message as context for chat
      cursorLine: 0,
      cursorColumn: 0,
      language: "Chat",
      framework: mode || "chat",
      suggestionType: `chat_${mode || "general"}`,
    };

    const cachedResponse = await semanticCache.getCachedSuggestion(cacheInput);

    if (cachedResponse) {
      // Return cached result as a stream for consistency
      const responseTime = Date.now() - requestStartTime;
      console.log(`⚡ CHAT CACHE HIT - Total response time: ${responseTime}ms`);

      const stream = new ReadableStream({
        start(controller) {
          // Send the cached response immediately
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                chunk: cachedResponse,
                done: false,
                cached: true,
                responseTime,
                model: "Cached Response",
              })}\n\n`
            )
          );

          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                done: true,
                cached: true,
                responseTime,
                model: "Cached Response",
              })}\n\n`
            )
          );

          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // 🤖 CACHE MISS - Generate new response
    console.log("🤖 CHAT CACHE MISS - Generating new response with Ollama...");

    // Create a readable stream
    let fullResponse = ""; // Track full response for caching

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "codellama:latest", 
              prompt,
              stream: true, // Enable streaming
              options: {
                temperature:
                  mode === "fix" ? 0.1 : mode === "optimize" ? 0.2 : 0.3,
                top_p: 0.9,
                top_k: 40,
                num_predict: mode === "chat" ? 800 : 600, // Longer for chat, shorter for specific tasks
                num_ctx: 3072, // Larger context for better understanding
                repeat_penalty: 1.1,
                stop: ["\n\nHuman:", "\n\nUser:", "Human:", "User:"],
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
          let totalTokens = 0;

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            buffer += new TextDecoder().decode(value);
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const data = JSON.parse(line);
                  if (data.response) {
                    totalTokens += 1; // Rough token counting
                    fullResponse += data.response; // Accumulate for caching

                    // Send each chunk to the client
                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify({
                          chunk: data.response,
                          done: data.done || false,
                          tokens: totalTokens,
                          model: "CodeLlama 7B",
                          cached: false,
                        })}\n\n`
                      )
                    );
                  }

                  if (data.done) {
                    // 💾 Cache the complete response
                    if (fullResponse.trim()) {
                      console.log("💾 Caching new chat response...");
                      await semanticCache.cacheSuggestion(
                        cacheInput,
                        fullResponse.trim()
                      );
                    }

                    const totalResponseTime = Date.now() - requestStartTime;
                    console.log(
                      `🤖 OLLAMA CHAT RESPONSE - Total time: ${totalResponseTime}ms`
                    );

                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify({
                          done: true,
                          tokens: totalTokens,
                          model: "CodeLlama 7B",
                          cached: false,
                          responseTime: totalResponseTime,
                        })}\n\n`
                      )
                    );
                    controller.close();
                    return;
                  }
                } catch (e) {
                  // Skip invalid JSON lines
                  console.warn("Failed to parse Ollama response line:", line);
                }
              }
            }
          }

          // Final completion signal with caching
          if (fullResponse.trim()) {
            console.log("💾 Caching final chat response...");
            await semanticCache.cacheSuggestion(
              cacheInput,
              fullResponse.trim()
            );
          }

          const totalResponseTime = Date.now() - requestStartTime;
          console.log(
            `🤖 OLLAMA CHAT FINAL - Total time: ${totalResponseTime}ms`
          );

          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                done: true,
                tokens: totalTokens,
                model: "CodeLlama 7B",
                cached: false,
                responseTime: totalResponseTime,
              })}\n\n`
            )
          );
          controller.close();
        } catch (error: any) {
          console.error("Streaming chat error:", error);

          // Send error to client
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                error: error.message || "Failed to generate response",
                done: true,
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error: any) {
    console.error("Chat streaming setup error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to setup streaming" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
