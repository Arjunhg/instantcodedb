import { useState, useRef, useCallback } from 'react';

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
  timestamp: Date;
  attachments?: any[];
  suggestions?: any[];
  type?: string;
  tokens?: number;
  model?: string;
  isStreaming?: boolean;
}

interface StreamingChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  currentStreamingMessageId: string | null;
}

interface UseStreamingChatReturn extends StreamingChatState {
  sendMessage: (message: string, options?: {
    attachments?: any[];
    mode?: string;
    history?: ChatMessage[];
  }) => Promise<void>;
  cancelStream: () => void;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
}

export const useStreamingChat = (): UseStreamingChatReturn => {
  const [state, setState] = useState<StreamingChatState>({
    messages: [],
    isLoading: false,
    isStreaming: false,
    error: null,
    currentStreamingMessageId: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const lastMessageRef = useRef<{
    message: string;
    options?: any;
  } | null>(null);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (readerRef.current) {
      readerRef.current.cancel();
      readerRef.current = null;
    }
    setState((prev) => ({ 
      ...prev, 
      isLoading: false, 
      isStreaming: false,
      currentStreamingMessageId: null,
      error: null 
    }));
  }, []);

  const sendMessage = useCallback(async (
    message: string, 
    options: {
      attachments?: any[];
      mode?: string;
      history?: ChatMessage[];
    } = {}
  ) => {
    if (!message.trim()) return;

    // Store for retry functionality
    lastMessageRef.current = { message, options };

    // Cancel any existing stream
    cancelStream();

    // Add user message
    const userMessage: ChatMessage = {
      role: "user",
      content: message.trim(),
      timestamp: new Date(),
      attachments: options.attachments || [],
      id: Date.now().toString(),
      type: options.mode || "chat",
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    // Create assistant message placeholder
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: "",
      timestamp: new Date(),
      id: assistantMessageId,
      type: options.mode || "chat",
      isStreaming: true,
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, assistantMessage],
      currentStreamingMessageId: assistantMessageId,
    }));

    try {
      // Create new abort controller
      abortControllerRef.current = new AbortController();

      // Prepare context
      let contextualMessage = message;
      if (options.attachments && options.attachments.length > 0) {
        contextualMessage += "\n\nAttached files:\n";
        options.attachments.forEach((file) => {
          contextualMessage += `\n**${file.name}** (${file.language}, ${file.type}):\n\`\`\`${file.language}\n${file.content.substring(0, 1000)}\n\`\`\`\n`;
        });
      }

      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: contextualMessage,
          history: (options.history || state.messages).slice(-10).map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          mode: options.mode || "chat",
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body available for streaming");
      }

      setState((prev) => ({ 
        ...prev, 
        isLoading: false, 
        isStreaming: true 
      }));

      const reader = response.body.getReader();
      readerRef.current = reader;
      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log("Chat stream completed");
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            currentStreamingMessageId: null,
            messages: prev.messages.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, isStreaming: false }
                : msg
            )
          }));
          break;
        }

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.chunk) {
                accumulatedContent += data.chunk;
                
                // Update message content in real-time
                setState((prev) => ({
                  ...prev,
                  messages: prev.messages.map(msg => 
                    msg.id === assistantMessageId 
                      ? { 
                          ...msg, 
                          content: accumulatedContent,
                          tokens: data.tokens,
                          model: data.model || "AI Assistant"
                        }
                      : msg
                  )
                }));
              }
              
              if (data.done) {
                console.log("Chat stream marked as done");
                setState((prev) => ({
                  ...prev,
                  isStreaming: false,
                  currentStreamingMessageId: null,
                  messages: prev.messages.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, isStreaming: false }
                      : msg
                  )
                }));
                return;
              }
            } catch (e) {
              console.warn("Failed to parse streaming chat data:", line);
            }
          }
        }
      }

    } catch (error: any) {
      console.error("Error in streaming chat:", error);
      
      if (error.name === 'AbortError') {
        console.log("Chat stream was cancelled");
        return;
      }

      // Remove the failed assistant message and show error
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isStreaming: false,
        currentStreamingMessageId: null,
        error: error.message || "Failed to get response",
        messages: prev.messages.filter(msg => msg.id !== assistantMessageId)
      }));

      // Add error message
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "I'm having trouble connecting right now. Please check your connection and try again.",
        timestamp: new Date(),
        id: Date.now().toString(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage]
      }));

    } finally {
      abortControllerRef.current = null;
      readerRef.current = null;
    }
  }, [state.messages, cancelStream]);

  const clearMessages = useCallback(() => {
    cancelStream();
    setState((prev) => ({
      ...prev,
      messages: [],
      error: null,
    }));
  }, [cancelStream]);

  const retryLastMessage = useCallback(async () => {
    if (!lastMessageRef.current) return;
    
    const { message, options } = lastMessageRef.current;
    await sendMessage(message, options);
  }, [sendMessage]);

  return {
    ...state,
    sendMessage,
    cancelStream,
    clearMessages,
    retryLastMessage,
  };
};