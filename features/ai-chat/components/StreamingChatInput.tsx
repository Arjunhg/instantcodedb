import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Paperclip } from "lucide-react";

interface StreamingAIChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (e: React.FormEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  disabled: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onAttachClick: () => void;
  chatMode: "chat" | "review" | "fix" | "optimize";
  isLoading: boolean;
  isStreaming: boolean;
}

export const StreamingAIChatInput = React.memo(function StreamingAIChatInput({
  value,
  onChange,
  onSend,
  onPaste,
  disabled,
  inputRef,
  onAttachClick,
  chatMode,
  isLoading,
  isStreaming,
}: StreamingAIChatInputProps) {
  return (
    <form
      onSubmit={onSend}
      className="shrink-0 p-4 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-sm"
    >
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          <Textarea
            ref={inputRef}
            placeholder={
              chatMode === "chat"
                ? "Ask about your code, request improvements, or paste code to analyze..."
                : chatMode === "review"
                ? "Describe what you'd like me to review in your code..."
                : chatMode === "fix"
                ? "Describe the issue you're experiencing..."
                : "Describe what you'd like me to optimize..."
            }
            value={value}
            onChange={(e) => {
              // Direct state update for better responsiveness
              onChange(e.target.value);
            }}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSend(e as any);
              }
            }}
            disabled={disabled}
            className="min-h-[44px] max-h-32 bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:ring-blue-500/20 resize-none pr-20"
            rows={1}
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onAttachClick}
              className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-300"
            >
              <Paperclip className="h-3 w-3" />
            </Button>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-xs text-zinc-500 bg-zinc-800 border border-zinc-700 rounded">
              ⌘↵
            </kbd>
          </div>
        </div>
        <Button
          type="submit"
          disabled={disabled || !value.trim()}
          className="h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading || isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </form>
  );
});