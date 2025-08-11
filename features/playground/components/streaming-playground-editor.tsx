"use client"

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react"
import Editor, { type Monaco } from "@monaco-editor/react"
import { configureMonaco, defaultEditorOptions, getEditorLanguage } from "@/features/playground/libs/editor-config"
import { useStreamingAISuggestions } from "@/features/playground/hooks/useStreamingAISuggestion"
import { StreamingSuggestionManager } from "@/features/playground/components/streaming-suggestion-manager"
import type { TemplateFile } from "@/features/playground/libs/path-to-json"

interface StreamingPlaygroundEditorProps {
  activeFile: TemplateFile | undefined
  content: string
  onContentChange: (value: string) => void
}

// Editor methods that can be called from parent components
export interface StreamingPlaygroundEditorRef {
  insertCode: (code: string, position?: { line: number; column: number }) => void
  replaceSelection: (code: string) => void
  replaceAll: (code: string) => void
  getCursorPosition: () => { line: number; column: number } | null
  focus: () => void
}

export const StreamingPlaygroundEditor = forwardRef<StreamingPlaygroundEditorRef, StreamingPlaygroundEditorProps>(({
  activeFile,
  content,
  onContentChange,
}, ref) => {
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const suggestionManagerRef = useRef<StreamingSuggestionManager | null>(null)

  const {
    suggestion,
    isLoading,
    isStreaming,
    position,
    isEnabled,
    error,
    toggleEnabled,
    fetchSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    clearSuggestion,
    cancelStream,
  } = useStreamingAISuggestions()

  // Expose editor methods to parent components
  useImperativeHandle(ref, () => ({
    insertCode: (code: string, position?: { line: number; column: number }) => {
      if (!editorRef.current) return;
      
      const editor = editorRef.current;
      const targetPosition = position || editor.getPosition();
      
      if (targetPosition) {
        editor.executeEdits('ai-insert', [{
          range: {
            startLineNumber: targetPosition.line,
            startColumn: targetPosition.column,
            endLineNumber: targetPosition.line,
            endColumn: targetPosition.column
          },
          text: code
        }]);
        
        // Update cursor position after insert
        const lines = code.split('\n');
        const newLine = targetPosition.line + lines.length - 1;
        const newColumn = lines.length === 1 
          ? targetPosition.column + code.length 
          : lines[lines.length - 1].length + 1;
          
        editor.setPosition({ lineNumber: newLine, column: newColumn });
        editor.focus();
      }
    },
    
    replaceSelection: (code: string) => {
      if (!editorRef.current) return;
      
      const editor = editorRef.current;
      const selection = editor.getSelection();
      
      if (selection) {
        editor.executeEdits('ai-replace-selection', [{
          range: selection,
          text: code
        }]);
        editor.focus();
      }
    },
    
    replaceAll: (code: string) => {
      if (!editorRef.current) return;
      
      const editor = editorRef.current;
      const model = editor.getModel();
      
      if (model) {
        const fullRange = model.getFullModelRange();
        editor.executeEdits('ai-replace-all', [{
          range: fullRange,
          text: code
        }]);
        editor.setPosition({ lineNumber: 1, column: 1 });
        editor.focus();
      }
    },
    
    getCursorPosition: () => {
      if (!editorRef.current) return null;
      
      const position = editorRef.current.getPosition();
      return position ? { line: position.lineNumber, column: position.column } : null;
    },
    
    focus: () => {
      if (editorRef.current) {
        editorRef.current.focus();
      }
    }
  }), []);

  // Initialize suggestion manager
  const initializeSuggestionManager = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) return

    if (suggestionManagerRef.current) {
      suggestionManagerRef.current.dispose()
    }

    suggestionManagerRef.current = new StreamingSuggestionManager(
      editorRef.current,
      monacoRef.current,
      {
        onAccept: (editor, monaco) => {
          console.log("Suggestion accepted via manager")
          acceptSuggestion(editor, monaco)
        },
        onReject: (editor) => {
          console.log("Suggestion rejected via manager")
          rejectSuggestion(editor)
        },
        onTrigger: (type, editor) => {
          console.log("Suggestion triggered via manager:", type)
          fetchSuggestion(type, editor)
        },
        onCancel: () => {
          console.log("Stream cancelled via manager")
          cancelStream()
        },
      }
    )
  }, [acceptSuggestion, rejectSuggestion, fetchSuggestion, cancelStream])

  // Update suggestion manager when suggestion changes
  useEffect(() => {
    if (!suggestionManagerRef.current) return

    if (isLoading && position) {
      // Start streaming suggestion
      suggestionManagerRef.current.startStreamingSuggestion(position)
    } else if (isStreaming && suggestion) {
      // Update streaming suggestion
      suggestionManagerRef.current.updateStreamingSuggestion(suggestion)
    } else if (!isStreaming && suggestion && position) {
      // Complete streaming or show final suggestion
      if (suggestionManagerRef.current.isStreaming()) {
        suggestionManagerRef.current.completeStreamingSuggestion()
      } else {
        suggestionManagerRef.current.showSuggestion(suggestion, position)
      }
    } else if (!suggestion && !isLoading) {
      // Clear suggestion
      suggestionManagerRef.current.clearSuggestion()
    }
  }, [suggestion, isLoading, isStreaming, position])

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    
    console.log("Streaming editor mounted")

    // Configure editor
    editor.updateOptions({
      ...defaultEditorOptions,
      inlineSuggest: {
        enabled: true,
        mode: "prefix",
        suppressSuggestions: false,
      },
      suggest: {
        preview: false,
        showInlineDetails: false,
        insertMode: "replace",
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false,
      },
    })

    configureMonaco(monaco)
    initializeSuggestionManager()

    // Keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      console.log("Ctrl+Space: Triggering streaming suggestion")
      fetchSuggestion("completion", editor)
    })

    // Tab to accept
    editor.addCommand(monaco.KeyCode.Tab, () => {
      if (suggestionManagerRef.current?.hasActiveSuggestion()) {
        console.log("Tab: Accepting streaming suggestion")
        const accepted = suggestionManagerRef.current.acceptSuggestion()
        if (accepted) return // Prevent default tab behavior
      }
      // Default tab behavior
      editor.trigger("keyboard", "tab", null)
    }, "editorTextFocus && !editorReadonly && !suggestWidgetVisible")

    // Escape to reject
    editor.addCommand(monaco.KeyCode.Escape, () => {
      if (suggestionManagerRef.current?.hasActiveSuggestion()) {
        console.log("Escape: Rejecting streaming suggestion")
        suggestionManagerRef.current.rejectSuggestion()
      }
    })

    // Double Enter for suggestions
    let lastEnterTime = 0
    editor.addCommand(monaco.KeyCode.Enter, () => {
      const now = Date.now()
      if (now - lastEnterTime < 500) { // Double enter within 500ms
        console.log("Double Enter: Triggering streaming suggestion")
        fetchSuggestion("completion", editor)
        lastEnterTime = 0 // Reset
      } else {
        lastEnterTime = now
        // Default enter behavior
        editor.trigger("keyboard", "type", { text: "\n" })
      }
    })

    // Auto-trigger suggestions on certain patterns
    editor.onDidChangeModelContent((e: any) => {
      if (isLoading || isStreaming) return

      if (e.changes.length > 0) {
        const change = e.changes[0]
        
        // Trigger on specific characters
        if (["\n", "{", ".", "=", "(", ",", ":", ";"].includes(change.text)) {
          setTimeout(() => {
            if (!suggestionManagerRef.current?.hasActiveSuggestion()) {
              fetchSuggestion("completion", editor)
            }
          }, 200)
        }
      }
    })

    // Clear suggestions when cursor moves away
    editor.onDidChangeCursorPosition((e: any) => {
      if (!suggestionManagerRef.current?.hasActiveSuggestion()) return

      const newPosition = e.position
      if (position && (
        newPosition.lineNumber !== position.line ||
        Math.abs(newPosition.column - position.column) > 5
      )) {
        console.log("Cursor moved away, clearing suggestion")
        suggestionManagerRef.current.clearSuggestion()
      }
    })

    updateEditorLanguage()
  }

  const updateEditorLanguage = () => {
    if (!activeFile || !monacoRef.current || !editorRef.current) return
    const model = editorRef.current.getModel()
    if (!model) return

    const language = getEditorLanguage(activeFile.fileExtension || "")
    try {
      monacoRef.current.editor.setModelLanguage(model, language)
    } catch (error) {
      console.warn("Failed to set editor language:", error)
    }
  }

  useEffect(() => {
    updateEditorLanguage()
  }, [activeFile])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (suggestionManagerRef.current) {
        suggestionManagerRef.current.dispose()
        suggestionManagerRef.current = null
      }
      cancelStream()
    }
  }, [cancelStream])

  return (
    <div className="h-full relative">
      {/* Status indicators */}
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        {/* AI Toggle */}
        <button
          onClick={toggleEnabled}
          className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
            isEnabled 
              ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" 
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${isEnabled ? "bg-green-500" : "bg-gray-400"}`}></div>
          AI {isEnabled ? "ON" : "OFF"}
        </button>

        {/* Loading indicator */}
        {isLoading && (
          <div className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            Thinking...
          </div>
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded text-xs text-purple-700 dark:text-purple-300 flex items-center gap-1">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
            Streaming...
          </div>
        )}

        {/* Suggestion ready */}
        {suggestion && !isStreaming && !isLoading && (
          <div className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            Press Tab to accept
          </div>
        )}

        {/* Error indicator */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900 px-2 py-1 rounded text-xs text-red-700 dark:text-red-300 flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            Error: {error}
          </div>
        )}
      </div>

      {/* Streaming progress bar */}
      {isStreaming && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-800 z-10">
          <div className="h-full bg-purple-500 animate-pulse"></div>
        </div>
      )}

      <Editor
        height="100%"
        value={content}
        onChange={(value) => onContentChange(value || "")}
        onMount={handleEditorDidMount}
        language={activeFile ? getEditorLanguage(activeFile.fileExtension || "") : "plaintext"}
        options={defaultEditorOptions}
      />

      {/* Streaming suggestion styles */}
      <style jsx global>{`
        .streaming-suggestion-cursor {
          position: relative;
        }
        
        .streaming-indicator {
          color: #8b5cf6;
          font-weight: bold;
          animation: pulse 1s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
})

StreamingPlaygroundEditor.displayName = "StreamingPlaygroundEditor"