# Streaming AI Integration Guide

This guide explains how to use the new streaming AI features in your application.

## 🚀 Features

### Monaco Editor Streaming

- **Real-time code suggestions** that appear as you type
- **Progressive text generation** - see suggestions build up character by character
- **Smart cancellation** - cancel slow suggestions and start new ones
- **Context-aware triggers** - automatic suggestions on specific patterns
- **Visual feedback** - loading, streaming, and ready indicators

### AI Chat Streaming

- **Live response streaming** - messages appear word by word like ChatGPT
- **Real-time progress** - see responses being generated
- **Cancellation support** - stop responses mid-stream
- **Error recovery** - automatic retry with exponential backoff
- **Multi-mode support** - different streaming behavior for chat/review/fix/optimize

## 🔧 Usage

### Using Streaming Monaco Editor

```tsx
import { StreamingPlaygroundEditor } from "@/features/playground/components/streaming-playground-editor";

function MyEditor() {
  const [content, setContent] = useState("");
  const [activeFile, setActiveFile] = useState(null);

  return (
    <StreamingPlaygroundEditor
      activeFile={activeFile}
      content={content}
      onContentChange={setContent}
    />
  );
}
```

**Keyboard Shortcuts:**

- `Ctrl+Space` - Trigger suggestion manually
- `Tab` - Accept streaming suggestion
- `Escape` - Cancel/reject suggestion
- `Double Enter` - Quick suggestion trigger

### Using Streaming Chat Panel

```tsx
import { StreamingAIChatSidePanel } from "@/features/ai-chat/components/streaming-ai-chat-sidepanel";

function MyApp() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <StreamingAIChatSidePanel
      isOpen={chatOpen}
      onClose={() => setChatOpen(false)}
      onInsertCode={(code, fileName, position) => {
        // Insert code into editor
      }}
      onRunCode={(code, language) => {
        // Execute code
      }}
      activeFileName="example.ts"
      activeFileContent="const x = 1;"
      activeFileLanguage="typescript"
      cursorPosition={{ line: 1, column: 12 }}
    />
  );
}
```

### Using Streaming Hooks Directly

```tsx
import { useStreamingAISuggestions } from "@/features/playground/hooks/useStreamingAISuggestion";
import { useStreamingChat } from "@/features/ai-chat/hooks/useStreamingChat";

function MyComponent() {
  // For code suggestions
  const { suggestion, isLoading, isStreaming, fetchSuggestion, cancelStream } =
    useStreamingAISuggestions();

  // For chat
  const {
    messages,
    isStreaming: chatStreaming,
    sendMessage,
    cancelStream: cancelChat,
  } = useStreamingChat();

  const handleTriggerSuggestion = () => {
    fetchSuggestion("completion", editorInstance);
  };

  const handleSendMessage = async () => {
    await sendMessage("Explain this code", {
      mode: "chat",
      attachments: [],
    });
  };
}
```

## ⚙️ Configuration

### API Endpoints

The streaming system uses these endpoints:

- `/api/code-suggestion/stream` - Streaming code suggestions
- `/api/chat/stream` - Streaming chat responses

### Model Configuration

Both endpoints use the optimized DeepSeek-Coder 1.3B model:

````typescript
// Optimized for speed
{
  model: "deepseek-coder:1.3b",
  stream: true,
  options: {
    temperature: 0.1,      // Lower for focused responses
    num_predict: 150,      // Shorter for faster streaming
    num_ctx: 2048,         // Smaller context window
    stop: ["\n\n", "```"], // Stop at natural breaks
  }
}
````

### Performance Tuning

**For faster responses:**

1. Use smaller models (1.3B vs 7B)
2. Reduce `num_predict` for shorter responses
3. Lower `temperature` for more focused output
4. Set appropriate `stop` tokens
5. Enable caching for repeated queries

**For better quality:**

1. Increase `num_ctx` for more context
2. Raise `temperature` slightly (0.2-0.3)
3. Remove aggressive stop tokens
4. Use larger models if performance allows

## 🛠️ Error Handling

The streaming system includes comprehensive error handling:

### Automatic Recovery

- **Network errors** - Auto-retry with exponential backoff
- **Timeout errors** - Retry with increased timeout
- **Parse errors** - Retry with error recovery
- **Server errors** - Retry with delay

### Manual Recovery

```tsx
const { error, retryLastMessage, cancelStream } = useStreamingChat();

if (error) {
  return (
    <div>
      <p>Error: {error}</p>
      <button onClick={retryLastMessage}>Retry</button>
      <button onClick={cancelStream}>Cancel</button>
    </div>
  );
}
```

### Error Types

- `NETWORK_ERROR` - Connection issues (recoverable)
- `TIMEOUT` - Request timeout (recoverable)
- `PARSE_ERROR` - Invalid response format (recoverable)
- `ABORT_ERROR` - User cancelled (not recoverable)
- `SERVER_ERROR` - Server issues (recoverable)
- `MODEL_ERROR` - AI model issues (recoverable)

## 🎨 Visual Indicators

### Monaco Editor Indicators

- **Blue dot + "Thinking..."** - Loading suggestion
- **Purple dot + "Streaming..."** - Receiving suggestion
- **Green dot + "Press Tab to accept"** - Suggestion ready
- **Red dot + error message** - Error occurred
- **Progress bar** - Streaming progress

### Chat Panel Indicators

- **Purple badge "Live"** - Currently streaming
- **Animated dots** - Processing/streaming
- **Stop button** - Cancel streaming
- **Retry button** - Retry failed requests
- **Progress bar** - Streaming progress

## 🔍 Debugging

### Enable Debug Logging

```typescript
// In browser console
localStorage.setItem("debug-streaming", "true");

// Or in code
console.log("Streaming debug:", {
  isStreaming,
  suggestion,
  error,
  position,
});
```

### Common Issues

**Suggestions not appearing:**

1. Check if AI is enabled (toggle button)
2. Verify Ollama is running (`ollama serve`)
3. Check model is available (`ollama list`)
4. Look for errors in browser console

**Slow streaming:**

1. Switch to smaller model (`deepseek-coder:1.3b`)
2. Reduce `num_predict` parameter
3. Check network connection
4. Monitor Ollama resource usage

**Stream interruptions:**

1. Check for network instability
2. Verify Ollama isn't overloaded
3. Look for timeout errors
4. Check browser memory usage

## 📊 Performance Metrics

### Expected Performance

- **DeepSeek-Coder 1.3B**: 1-3 seconds first token, 50-100 tokens/sec
- **CodeLlama 7B**: 3-8 seconds first token, 20-50 tokens/sec
- **Cache hits**: <100ms response time
- **Network latency**: +50-200ms depending on connection

### Monitoring

```typescript
import { aiPerformanceMonitor } from "@/lib/ai-performance";

// Log performance stats
aiPerformanceMonitor.logStats();

// Get metrics
const metrics = aiPerformanceMonitor.getMetrics();
console.log("Average response time:", metrics.averageTime);
console.log("Cache hit rate:", metrics.cacheHitRate);
```

## 🚀 Best Practices

### For Developers

1. **Always handle errors** - Streaming can fail
2. **Provide cancellation** - Let users stop slow requests
3. **Show progress** - Visual feedback improves UX
4. **Cache aggressively** - Reduce redundant requests
5. **Debounce triggers** - Avoid request spam

### For Users

1. **Wait for completion** - Don't interrupt streaming
2. **Use keyboard shortcuts** - Faster than clicking
3. **Cancel slow requests** - Don't wait forever
4. **Attach relevant files** - Better context = better suggestions
5. **Use specific modes** - Review/Fix/Optimize for targeted help

## 🔄 Migration from Non-Streaming

### Replace Components

```tsx
// Old
import { PlaygroundEditor } from "./playground-editor";
import { AIChatSidePanel } from "./ai-chat-sidepanel";

// New
import { StreamingPlaygroundEditor } from "./streaming-playground-editor";
import { StreamingAIChatSidePanel } from "./streaming-ai-chat-sidepanel";
```

### Update API Calls

```tsx
// Old
const response = await fetch("/api/code-suggestion", { ... })
const data = await response.json()

// New - handled automatically by hooks
const { fetchSuggestion } = useStreamingAISuggestions()
await fetchSuggestion("completion", editor)
```

### Handle New States

```tsx
// Add streaming states to your UI
const { isLoading, isStreaming, error } = useStreamingAISuggestions();

return (
  <div>
    {isLoading && <LoadingSpinner />}
    {isStreaming && <StreamingIndicator />}
    {error && <ErrorMessage error={error} />}
  </div>
);
```

This streaming integration provides a much more responsive and interactive AI experience, similar to modern AI tools like ChatGPT and GitHub Copilot.
