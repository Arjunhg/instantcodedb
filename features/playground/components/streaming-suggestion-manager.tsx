import type { Monaco } from "@monaco-editor/react"
import type { editor as MonacoEditor, IDisposable } from "monaco-editor"

interface StreamingSuggestionCallbacks {
  onAccept: (editor: MonacoEditor.IStandaloneCodeEditor, monaco: Monaco) => void
  onReject: (editor: MonacoEditor.IStandaloneCodeEditor) => void
  onTrigger: (type: string, editor: MonacoEditor.IStandaloneCodeEditor) => void
  onCancel: () => void
}

interface ActiveStreamingSuggestion {
  text: string
  position: { line: number; column: number }
  id: string
  isStreaming: boolean
}

export class StreamingSuggestionManager {
  private editor: MonacoEditor.IStandaloneCodeEditor
  private monaco: Monaco
  private callbacks: StreamingSuggestionCallbacks
  private activeSuggestion: ActiveStreamingSuggestion | null = null
  private inlineProvider: IDisposable | null = null
  private decorations: string[] = []
  private isAccepting = false
  private updateInterval: NodeJS.Timeout | null = null

  constructor(
    editor: MonacoEditor.IStandaloneCodeEditor, 
    monaco: Monaco, 
    callbacks: StreamingSuggestionCallbacks
  ) {
    this.editor = editor
    this.monaco = monaco
    this.callbacks = callbacks
  }

  /**
   * Start showing a streaming suggestion
   */
  startStreamingSuggestion(position: { line: number; column: number }): void {
    this.clearSuggestion()

    this.activeSuggestion = {
      text: "",
      position,
      id: this.generateId(),
      isStreaming: true,
    }

    console.log("Started streaming suggestion at position:", position)
    this.registerInlineProvider()
  }

  /**
   * Update the streaming suggestion with new text
   */
  updateStreamingSuggestion(newText: string): void {
    if (!this.activeSuggestion) return

    this.activeSuggestion.text = newText
    this.updateInlineDisplay()
    
    console.log("Updated streaming suggestion:", newText.substring(0, 50) + "...")
  }

  /**
   * Complete the streaming suggestion
   */
  completeStreamingSuggestion(): void {
    if (!this.activeSuggestion) return

    this.activeSuggestion.isStreaming = false
    console.log("Completed streaming suggestion")
    
    // Trigger final update
    this.updateInlineDisplay()
  }

  /**
   * Show a complete suggestion (non-streaming)
   */
  showSuggestion(text: string, position: { line: number; column: number }): void {
    this.clearSuggestion()

    this.activeSuggestion = {
      text: text.replace(/\r/g, ""),
      position,
      id: this.generateId(),
      isStreaming: false,
    }

    this.registerInlineProvider()
    this.updateInlineDisplay()
  }

  /**
   * Clear the current suggestion
   */
  clearSuggestion(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }

    if (this.inlineProvider) {
      this.inlineProvider.dispose()
      this.inlineProvider = null
    }

    if (this.decorations.length > 0) {
      this.decorations = this.editor.deltaDecorations(this.decorations, [])
    }

    this.activeSuggestion = null

    if (this.editor) {
      this.editor.trigger("ai", "editor.action.inlineSuggest.hide", null)
    }
  }

  /**
   * Accept the current suggestion
   */
  acceptSuggestion(): boolean {
    if (!this.activeSuggestion || this.isAccepting) {
      return false
    }

    // Don't accept while still streaming
    if (this.activeSuggestion.isStreaming) {
      console.log("Cannot accept suggestion while still streaming")
      return false
    }

    this.isAccepting = true

    try {
      const suggestion = this.activeSuggestion
      const currentPosition = this.editor.getPosition()

      if (!currentPosition) {
        console.error("Current editor position is null")
        return false
      }

      // Create range from suggestion position to current position
      const range = new this.monaco.Range(
        suggestion.position.line,
        suggestion.position.column,
        currentPosition.lineNumber,
        currentPosition.column,
      )

      // Execute the edit
      const success = this.editor.executeEdits("streaming-ai-suggestion-accept", [
        {
          range,
          text: suggestion.text,
          forceMoveMarkers: true,
        },
      ])

      if (!success) {
        console.error("Failed to execute edit")
        return false
      }

      // Calculate new cursor position
      const lines = suggestion.text.split("\n")
      let newLine: number
      let newColumn: number

      if (lines.length === 1) {
        newLine = suggestion.position.line
        newColumn = suggestion.position.column + suggestion.text.length
      } else {
        newLine = suggestion.position.line + lines.length - 1
        newColumn = lines[lines.length - 1].length + 1
      }

      // Set cursor to end of inserted text
      this.editor.setPosition({
        lineNumber: newLine,
        column: newColumn,
      })

      console.log("Streaming suggestion accepted successfully")

      // Clear suggestion and call callback
      this.clearSuggestion()
      this.callbacks.onAccept(this.editor, this.monaco)

      return true
    } catch (error) {
      console.error("Error accepting streaming suggestion:", error)
      return false
    } finally {
      this.isAccepting = false
    }
  }

  /**
   * Reject the current suggestion
   */
  rejectSuggestion(): void {
    if (this.activeSuggestion) {
      // Cancel streaming if active
      if (this.activeSuggestion.isStreaming) {
        this.callbacks.onCancel()
      }
      
      this.clearSuggestion()
      this.callbacks.onReject(this.editor)
    }
  }

  /**
   * Check if there's an active suggestion
   */
  hasActiveSuggestion(): boolean {
    return this.activeSuggestion !== null
  }

  /**
   * Check if currently streaming
   */
  isStreaming(): boolean {
    return this.activeSuggestion?.isStreaming || false
  }

  /**
   * Get current suggestion text
   */
  getCurrentSuggestion(): string {
    return this.activeSuggestion?.text || ""
  }

  /**
   * Update the inline display
   */
  private updateInlineDisplay(): void {
    if (!this.activeSuggestion) return

    // Clear existing decorations
    if (this.decorations.length > 0) {
      this.decorations = this.editor.deltaDecorations(this.decorations, [])
    }

    // Add streaming indicator decoration
    if (this.activeSuggestion.isStreaming) {
      const position = this.activeSuggestion.position
      this.decorations = this.editor.deltaDecorations([], [
        {
          range: new this.monaco.Range(position.line, position.column, position.line, position.column),
          options: {
            className: 'streaming-suggestion-cursor',
            after: {
              content: '⚡',
              inlineClassName: 'streaming-indicator'
            }
          }
        }
      ])
    }

    // Trigger inline suggestions update
    setTimeout(() => {
      if (this.editor && this.activeSuggestion) {
        this.editor.trigger("ai", "editor.action.inlineSuggest.trigger", null)
      }
    }, 10)
  }

  /**
   * Register inline completion provider
   */
  private registerInlineProvider(): void {
    if (!this.activeSuggestion) return

    const language = this.getEditorLanguage()

    this.inlineProvider = this.monaco.languages.registerInlineCompletionsProvider(language, {
      provideInlineCompletions: async (model: any, position: any) => {
        if (!this.activeSuggestion || this.isAccepting) {
          return { items: [] }
        }

        // Check position match
        const isMatch =
          position.lineNumber === this.activeSuggestion.position.line &&
          position.column >= this.activeSuggestion.position.column &&
          position.column <= this.activeSuggestion.position.column + 5

        if (!isMatch) {
          return { items: [] }
        }

        // Don't show empty suggestions
        if (!this.activeSuggestion.text.trim()) {
          return { items: [] }
        }

        const displayText = this.activeSuggestion.isStreaming 
          ? this.activeSuggestion.text + "⚡" 
          : this.activeSuggestion.text

        return {
          items: [
            {
              insertText: this.activeSuggestion.text,
              range: new this.monaco.Range(
                position.lineNumber, 
                position.column, 
                position.lineNumber, 
                position.column
              ),
              kind: this.monaco.languages.CompletionItemKind.Snippet,
              label: this.activeSuggestion.isStreaming ? "AI Streaming..." : "AI Suggestion",
              detail: this.activeSuggestion.isStreaming 
                ? "Streaming AI-generated code" 
                : "AI-generated code suggestion",
              documentation: this.activeSuggestion.isStreaming 
                ? "Wait for completion or press Tab to accept current" 
                : "Press Tab to accept",
              sortText: "0000",
              filterText: "",
            },
          ],
        }
      },
      freeInlineCompletions: () => {},
    })
  }

  /**
   * Get the current editor language
   */
  private getEditorLanguage(): string {
    const model = this.editor.getModel()
    return model ? model.getLanguageId() : "javascript"
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `streaming-suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clearSuggestion()
  }
}