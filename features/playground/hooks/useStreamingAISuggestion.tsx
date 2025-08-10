import { useState, useRef, useCallback } from "react";

interface StreamingAISuggestionsState {
  suggestion: string;
  isLoading: boolean;
  isStreaming: boolean;
  position: { line: number; column: number } | null;
  decoration: string[];
  isEnabled: boolean;
  error: string | null;
}

interface UseStreamingAISuggestionsReturn extends StreamingAISuggestionsState {
  toggleEnabled: () => void;
  fetchSuggestion: (type: string, editor: any) => Promise<void>;
  acceptSuggestion: (editor: any, monaco: any) => void;
  rejectSuggestion: (editor: any) => void;
  clearSuggestion: (editor: any) => void;
  cancelStream: () => void;
}

export const useStreamingAISuggestions = (): UseStreamingAISuggestionsReturn => {
  const [state, setState] = useState<StreamingAISuggestionsState>({
    suggestion: "",
    isLoading: false,
    isStreaming: false,
    position: null,
    decoration: [],
    isEnabled: true,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);

  const toggleEnabled = useCallback(() => {
    console.log("Toggling streaming AI suggestions");
    setState((prev) => ({ ...prev, isEnabled: !prev.isEnabled }));
  }, []);

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
      error: null 
    }));
  }, []);

  const fetchSuggestion = useCallback(async (type: string, editor: any) => {
    console.log("Fetching streaming AI suggestion...");
    
    setState((currentState) => {
      if (!currentState.isEnabled) {
        console.warn("Streaming AI suggestions are disabled.");
        return currentState;
      }

      if (!editor) {
        console.warn("Editor instance is not available.");
        return currentState;
      }

      const model = editor.getModel();
      const cursorPosition = editor.getPosition();

      if (!model || !cursorPosition) {
        console.warn("Editor model or cursor position is not available.");
        return currentState;
      }

      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      // Set loading state immediately
      const newState = { 
        ...currentState, 
        isLoading: true, 
        isStreaming: false,
        suggestion: "",
        error: null,
        position: {
          line: cursorPosition.lineNumber,
          column: cursorPosition.column,
        }
      };

      // Start streaming
      (async () => {
        try {
          const payload = {
            fileContent: model.getValue(),
            cursorLine: cursorPosition.lineNumber - 1,
            cursorColumn: cursorPosition.column - 1,
            suggestionType: type,
            fileName: model.uri?.path?.split('/').pop() || 'file.js', // Add filename for better language detection
          };

          console.log("Streaming request payload:", {
            ...payload,
            fileContent: payload.fileContent.substring(0, 200) + "..." // Don't log entire file
          });

          const response = await fetch("/api/code-suggestion/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: abortControllerRef.current?.signal,
          });

          if (!response.ok) {
            throw new Error(`API responded with status ${response.status}`);
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
          let accumulatedSuggestion = "";

          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log("Stream completed");
              setState((prev) => ({ ...prev, isStreaming: false }));
              break;
            }

            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.chunk) {
                    accumulatedSuggestion += data.chunk;
                    
                    // Clean accumulated suggestion
                    let cleanSuggestion = accumulatedSuggestion.trim();
                    
                    // Remove cursor markers if present
                    cleanSuggestion = cleanSuggestion.replace(/\|CURSOR\|/g, "");
                    
                    // Remove code block markers if present
                    if (cleanSuggestion.includes("```")) {
                      const codeMatch = cleanSuggestion.match(/```[\w]*\n?([\s\S]*?)```/);
                      cleanSuggestion = codeMatch ? codeMatch[1].trim() : cleanSuggestion;
                    }
                    
                    // Update suggestion in real-time
                    setState((prev) => ({
                      ...prev,
                      suggestion: cleanSuggestion,
                    }));
                  }
                  
                  if (data.done) {
                    console.log("Stream marked as done");
                    setState((prev) => ({ ...prev, isStreaming: false }));
                    return;
                  }
                } catch (e) {
                  console.warn("Failed to parse streaming data:", line);
                }
              }
            }
          }

        } catch (error: any) {
          console.error("Error in streaming suggestion:", error);
          
          if (error.name === 'AbortError') {
            console.log("Stream was cancelled");
            return;
          }

          setState((prev) => ({ 
            ...prev, 
            isLoading: false, 
            isStreaming: false,
            error: error.message || "Failed to get suggestion"
          }));
        } finally {
          abortControllerRef.current = null;
          readerRef.current = null;
        }
      })();

      return newState;
    });
  }, []);

  const acceptSuggestion = useCallback(
    (editor: any, monaco: any) => {
      setState((currentState) => {
        if (!currentState.suggestion || !currentState.position || !editor || !monaco) {
          return currentState;
        }

        const { line, column } = currentState.position;
        const sanitizedSuggestion = currentState.suggestion.replace(/^\d+:\s*/gm, "");

        try {
          editor.executeEdits("streaming-ai-suggestion", [
            {
              range: new monaco.Range(line, column, line, column),
              text: sanitizedSuggestion,
              forceMoveMarkers: true,
            },
          ]);

          // Clear decorations
          if (editor && currentState.decoration.length > 0) {
            editor.deltaDecorations(currentState.decoration, []);
          }

          console.log("Streaming suggestion accepted successfully");
        } catch (error) {
          console.error("Error accepting streaming suggestion:", error);
        }

        return {
          ...currentState,
          suggestion: "",
          position: null,
          decoration: [],
          isStreaming: false,
          error: null,
        };
      });
    },
    []
  );

  const rejectSuggestion = useCallback((editor: any) => {
    cancelStream();
    setState((currentState) => {
      if (editor && currentState.decoration.length > 0) {
        editor.deltaDecorations(currentState.decoration, []);
      }
      return {
        ...currentState,
        suggestion: "",
        position: null,
        decoration: [],
        isStreaming: false,
        error: null,
      };
    });
  }, [cancelStream]);

  const clearSuggestion = useCallback((editor: any) => {
    cancelStream();
    setState((currentState) => {
      if (editor && currentState.decoration.length > 0) {
        editor.deltaDecorations(currentState.decoration, []);
      }
      return {
        ...currentState,
        suggestion: "",
        position: null,
        decoration: [],
        isStreaming: false,
        error: null,
      };
    });
  }, [cancelStream]);

  return {
    ...state,
    toggleEnabled,
    fetchSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    clearSuggestion,
    cancelStream,
  };
};