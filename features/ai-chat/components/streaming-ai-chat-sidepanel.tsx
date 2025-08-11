"use client";

import React from "react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StreamingAIChatInput } from "./StreamingChatInput";
import {
  Loader2,
  Send,
  User,
  Copy,
  Check,
  X,
  Paperclip,
  FileText,
  Code,
  Sparkles,
  MessageSquare,
  RefreshCw,
  Plus,
  Minus,
  Settings,
  Zap,
  Brain,
  Terminal,
  Search,
  Filter,
  Download,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { EnhancedCodeBlock } from "./ai-chat-code-blocks";
import { EnhancedFilePreview } from "./file-preview";
import { useStreamingChat } from "../hooks/useStreamingChat";
import "katex/dist/katex.min.css";

interface FileAttachment {
  id: string;
  name: string;
  content: string;
  language: string;
  size: number;
  type: "code";
  preview?: string;
  mimeType?: string;
}

interface StreamingAIChatSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertCode?: (
    code: string,
    fileName?: string,
    position?: { line: number; column: number }
  ) => void;
  onRunCode?: (code: string, language: string) => void;
  activeFileName?: string;
  activeFileContent?: string;
  activeFileLanguage?: string;
  cursorPosition?: { line: number; column: number };
  theme?: "dark" | "light";
}

export const StreamingAIChatSidePanel: React.FC<StreamingAIChatSidePanelProps> = React.memo(({
  isOpen,
  onClose,
  onInsertCode,
  onRunCode,
  activeFileName,
  activeFileContent,
  activeFileLanguage,
  cursorPosition,
  theme = "dark",
}) => {
  const [input, setInput] = useState("");
  // const [debouncedInput, setDebouncedInput] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [chatMode, setChatMode] = useState<
    "chat" | "review" | "fix" | "optimize"
  >("chat");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Debounce input for better performance
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     setDebouncedInput(input);
  //   }, 100); // 100ms debounce

  //   return () => clearTimeout(timer);
  // }, [input]);

  const {
    messages,
    isLoading,
    isStreaming,
    error,
    currentStreamingMessageId,
    sendMessage,
    cancelStream,
    clearMessages,
    retryLastMessage,
  } = useStreamingChat();

  // Debug effect to track activeFile changes - only when panel is open and meaningful changes occur
  useEffect(() => {
    // Only log when panel is open to avoid unnecessary logging
    if (isOpen) {
      console.log('StreamingAIChatSidePanel props updated:', {
        activeFileName,
        activeFileContent: activeFileContent?.substring(0, 50) + '...',
        activeFileLanguage,
        cursorPosition,
        contentLength: activeFileContent?.length
      });
    }
  }, [
    isOpen,
    activeFileName, 
    activeFileLanguage, 
    activeFileContent?.length, 
    cursorPosition?.line
  ]);

  // Optimized scroll function with debouncing
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth",
        block: "end"
      });
    }
  }, []);

  // Debounced scroll effect
  useEffect(() => {
    const timeoutId = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timeoutId);
  }, [messages.length, isLoading, isStreaming, scrollToBottom]);

  // Enhanced language detection
  const detectLanguage = (fileName: string, content: string): string => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext) {
      const langMap: { [key: string]: string } = {
        js: "javascript",
        jsx: "jsx",
        ts: "typescript",
        tsx: "tsx",
        py: "python",
        java: "java",
        cpp: "cpp",
        c: "c",
        html: "html",
        css: "css",
        scss: "scss",
        sass: "sass",
        json: "json",
        xml: "xml",
        yaml: "yaml",
        yml: "yaml",
        md: "markdown",
        sql: "sql",
        sh: "bash",
        bash: "bash",
        ps1: "powershell",
        php: "php",
        rb: "ruby",
        go: "go",
        rs: "rust",
        swift: "swift",
        kt: "kotlin",
        dart: "dart",
        r: "r",
        scala: "scala",
        clj: "clojure",
        hs: "haskell",
        elm: "elm",
        vue: "vue",
        svelte: "svelte",
      };
      return langMap[ext] || "text";
    }

    // Content-based detection
    if (content.includes("import React") || content.includes("useState"))
      return "jsx";
    if (content.includes("interface ") || content.includes(": string"))
      return "typescript";
    if (content.includes("def ") && content.includes("import "))
      return "python";
    if (content.includes("package ") && content.includes("public class"))
      return "java";
    if (content.includes("#include") && content.includes("int main"))
      return "cpp";
    if (content.includes("<!DOCTYPE html") || content.includes("<html"))
      return "html";
    if (content.includes("SELECT") && content.includes("FROM")) return "sql";

    return "text";
  };

  // Memoized file attachment handlers
  const addFileAttachment = useCallback((
    fileName: string,
    content: string,
    mimeType?: string
  ) => {
    const language = detectLanguage(fileName, content);
    const newFile: FileAttachment = {
      id: Date.now().toString(),
      name: fileName,
      content: content.trim(),
      language,
      size: content.length,
      type: "code",
      preview: content.substring(0, 200) + (content.length > 200 ? "..." : ""),
      mimeType,
    };
    setAttachments((prev) => [...prev, newFile]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData("text");

    if (pastedText.length > 50 && pastedText.includes("\n")) {
      const lines = pastedText.split("\n");
      const hasImports = lines.some(
        (line) =>
          line.trim().startsWith("import ") || line.trim().startsWith("from ")
      );
      const hasFunctions = lines.some(
        (line) =>
          line.includes("function ") ||
          line.includes("def ") ||
          line.includes("=>") ||
          line.includes("class ") ||
          line.includes("interface ")
      );
      const hasCodeStructure = lines.some(
        (line) =>
          line.includes("{") ||
          line.includes("}") ||
          line.includes("class ") ||
          line.includes("SELECT") ||
          line.includes("CREATE")
      );

      if (hasImports || hasFunctions || hasCodeStructure) {
        e.preventDefault();

        let suggestedName = "pasted-code.txt";
        if (hasImports && pastedText.includes("React")) {
          suggestedName =
            pastedText.includes("tsx") || pastedText.includes("interface")
              ? "component.tsx"
              : "component.jsx";
        } else if (
          pastedText.includes("def ") ||
          pastedText.includes("import ")
        ) {
          suggestedName = "script.py";
        } else if (
          pastedText.includes("function ") ||
          pastedText.includes("=>")
        ) {
          suggestedName = pastedText.includes("interface")
            ? "script.ts"
            : "script.js";
        }

        const fileName = prompt(
          `Detected code content! Enter filename:`,
          suggestedName
        );
        if (fileName) {
          addFileAttachment(fileName, pastedText);
          return;
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        addFileAttachment(file.name, content, file.type);
      };
      reader.readAsText(file);
    });
  };

  const getChatModePrompt = (mode: string, content: string) => {
    const baseContext = {
      activeFile: activeFileName,
      language: activeFileLanguage,
      cursorPosition,
      attachments: attachments.map((f) => ({
        name: f.name,
        language: f.language,
        size: f.size,
        type: f.type,
      })),
    };

    switch (mode) {
      case "review":
        return `Please review this code and provide detailed suggestions for improvement, including performance, security, and best practices:\n\n**Context:** ${JSON.stringify(
          baseContext
        )}\n\n**Request:** ${content}`;
      case "fix":
        return `Please help fix issues in this code, including bugs, errors, and potential problems:\n\n**Context:** ${JSON.stringify(
          baseContext
        )}\n\n**Problem:** ${content}`;
      case "optimize":
        return `Please analyze this code for performance optimizations and suggest improvements:\n\n**Context:** ${JSON.stringify(
          baseContext
        )}\n\n**Code to optimize:** ${content}`;
      default:
        return content;
    }
  };

  // Optimized message sending with better error handling
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading || isStreaming) return;

    // Clear input immediately for better UX
    setInput("");
    
    try {
      const contextualMessage = getChatModePrompt(chatMode, trimmedInput);

      await sendMessage(contextualMessage, {
        attachments: [...attachments],
        mode: chatMode,
        history: messages.slice(-10),
      });

      // Clear attachments after successful send
      setAttachments([]);
      
      // Focus back to input for continuous typing
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      
    } catch (error) {
      // Restore input on error
      setInput(trimmedInput);
      console.error('Failed to send message:', error);
    }
  }, [input, isLoading, isStreaming, chatMode, attachments, messages, sendMessage]);

  const handleInsertCode = (
    code: string,
    fileName?: string,
    position?: { line: number; column: number }
  ) => {
    if (onInsertCode) {
      onInsertCode(
        code,
        fileName || activeFileName,
        position || cursorPosition
      );
    }
  };

  // Fixed addCurrentFileAsContext function with proper debugging
  const addCurrentFileAsContext = useCallback(() => {
    console.log('addCurrentFileAsContext called with:', {
      activeFileName,
      activeFileContent: activeFileContent?.substring(0, 100) + '...',
      hasContent: !!activeFileContent
    });
    
    if (activeFileName && activeFileContent) {
      // Ensure we're using the actual current file data
      const currentFileData = {
        fileName: activeFileName,
        content: activeFileContent,
        language: activeFileLanguage || detectLanguage(activeFileName, activeFileContent)
      };
      
      console.log('Adding file to context:', currentFileData.fileName);
      addFileAttachment(currentFileData.fileName, currentFileData.content);
    } else {
      console.warn('Cannot add current file - missing fileName or content:', {
        hasFileName: !!activeFileName,
        hasContent: !!activeFileContent
      });
    }
  }, [activeFileName, activeFileContent, activeFileLanguage]);

  const exportChat = () => {
    const chatData = {
      messages,
      timestamp: new Date().toISOString(),
      activeFile: activeFileName,
      attachments: attachments.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      })),
    };
    const blob = new Blob([JSON.stringify(chatData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `streaming-ai-chat-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Memoized filtered messages for better performance
  const filteredMessages = useMemo(() => {
    return messages
      .filter((msg) => {
        if (filterType === "all") return true;
        return msg.type === filterType;
      })
      .filter((msg) => {
        if (!searchTerm) return true;
        return msg.content.toLowerCase().includes(searchTerm.toLowerCase());
      });
  }, [messages, filterType, searchTerm]);

  return (
    <TooltipProvider>
      <>
        {/* Backdrop */}
        <div
          className={cn(
            "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300",
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={onClose}
        />

        {/* Side Panel */}
        <div
          className={cn(
            "fixed right-0 top-0 h-full w-full max-w-6xl bg-zinc-950 border-l border-zinc-800 z-50 flex flex-col transition-transform duration-300 ease-out shadow-2xl",
            isOpen ? "translate-x-0" : "translate-x-full"
          )}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
        >
          {/* Drag overlay */}
          {dragOver && (
            <div className="absolute inset-0 bg-blue-500/20 border-2 border-dashed border-blue-400 z-10 flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-12 w-12 text-blue-400 mx-auto mb-2" />
                <p className="text-blue-400 font-medium">
                  Drop files here to attach
                </p>
              </div>
            </div>
          )}

          {/* Streaming progress bar */}
          {isStreaming && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-800 z-10">
              <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse"></div>
            </div>
          )}

          {/* Enhanced Header */}
          <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 border rounded-full flex flex-col justify-center items-center">
                  <Image src={"/logo.svg"} alt="Logo" width={28} height={28} />
                  {isStreaming && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                    Streaming AI Assistant
                    {isStreaming && (
                      <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
                        Live
                      </Badge>
                    )}
                  </h2>
                  <p className="text-sm text-zinc-400">
                    {activeFileName
                      ? `Working on ${activeFileName}`
                      : "No active file"}{" "}
                    • {messages.length} messages
                    {isStreaming && " • Streaming response..."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Cancel streaming button */}
                {isStreaming && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelStream}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Square className="h-4 w-4 mr-1" />
                        Stop
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Cancel streaming response</TooltipContent>
                  </Tooltip>
                )}

                {/* Retry button */}
                {error && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={retryLastMessage}
                        className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Retry
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Retry last message</TooltipContent>
                  </Tooltip>
                )}

                {activeFileName && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={addCurrentFileAsContext}
                        className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Current File
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add current file as context</TooltipContent>
                  </Tooltip>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                >
                  <Paperclip className="h-4 w-4 mr-1" />
                  Attach
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportChat}>
                      <Download className="h-4 w-4 mr-2" />
                      Export Chat
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={clearMessages}>
                      Clear All Messages
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Enhanced Controls */}
            <Tabs
              value={chatMode}
              onValueChange={(value) => setChatMode(value as any)}
              className="px-6"
            >
              <div className="flex items-center justify-between mb-4">
                <TabsList className="grid w-full grid-cols-4 max-w-md">
                  <TabsTrigger value="chat" className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger
                    value="review"
                    className="flex items-center gap-1"
                  >
                    <Code className="h-3 w-3" />
                    Review
                  </TabsTrigger>
                  <TabsTrigger value="fix" className="flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Fix
                  </TabsTrigger>
                  <TabsTrigger
                    value="optimize"
                    className="flex items-center gap-1"
                  >
                    <Zap className="h-3 w-3" />
                    Optimize
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-zinc-500" />
                    <Input
                      placeholder="Search messages..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-7 h-8 w-40 bg-zinc-800/50 border-zinc-700/50"
                    />
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Filter className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setFilterType("all")}>
                        All Messages
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setFilterType("chat")}>
                        Chat Only
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setFilterType("code_review")}
                      >
                        Code Reviews
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setFilterType("error_fix")}
                      >
                        Error Fixes
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setFilterType("optimization")}
                      >
                        Optimizations
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Tabs>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto bg-zinc-950">
            <div className="p-6 space-y-6">
              {filteredMessages.length === 0 && !isLoading && !isStreaming && (
                <div className="text-center text-zinc-500 py-16">
                  <div className="relative w-16 h-16 border rounded-full flex flex-col justify-center items-center mx-auto mb-4">
                    <Brain className="h-8 w-8 text-zinc-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-zinc-300">
                    Streaming AI Assistant
                  </h3>
                  <p className="text-zinc-400 max-w-md mx-auto leading-relaxed mb-6">
                    Real-time AI coding assistant with streaming responses, file attachments, 
                    and comprehensive analysis capabilities.
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
                    {[
                      "Review my React component for performance",
                      "Fix TypeScript compilation errors",
                      "Optimize database query performance",
                      "Add comprehensive error handling",
                      "Implement security best practices",
                      "Refactor code for better maintainability",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors text-left"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredMessages.map((msg, index) => (
                <div key={msg.id} className="space-y-4">
                  <div
                    className={cn(
                      "flex items-start gap-4 group",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="relative w-10 h-10 border rounded-full flex flex-col justify-center items-center">
                        <Brain className="h-5 w-5 text-zinc-400" />
                        {msg.isStreaming && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                        )}
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl shadow-sm",
                        msg.role === "user"
                          ? "bg-zinc-900/70 text-white p-4 rounded-br-md"
                          : "bg-zinc-900/80 backdrop-blur-sm text-zinc-100 p-5 rounded-bl-md border border-zinc-800/50"
                      )}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3 text-zinc-400" />
                            <span className="text-xs font-medium text-zinc-400">
                              {msg.isStreaming ? "Streaming..." : "Response"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            {msg.model && <span>{msg.model}</span>}
                            {msg.tokens && <span>{msg.tokens} tokens</span>}
                            {msg.isStreaming && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                                <span>Live</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            code: ({
                              children,
                              className,
                              ...props
                            }) => (
                              <EnhancedCodeBlock
                                className={className}
                                inline={(props as any).inline as boolean}
                                onInsert={
                                  onInsertCode
                                    ? (code) => handleInsertCode(code)
                                    : undefined
                                }
                                onRun={onRunCode}
                                theme={theme}
                              >
                                {String(children)}
                              </EnhancedCodeBlock>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>

                      {/* Show attachments for user messages */}
                      {msg.role === "user" &&
                        msg.attachments &&
                        msg.attachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs text-zinc-400 mb-2">
                              Attached files:
                            </div>
                            {msg.attachments.map((file) => (
                              <EnhancedFilePreview
                                key={file.id}
                                file={file}
                                onRemove={() => {}}
                                compact={true}
                                onInsert={
                                  onInsertCode
                                    ? (code) => handleInsertCode(code)
                                    : undefined
                                }
                              />
                            ))}
                          </div>
                        )}

                      {/* Message actions */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-700/30">
                        <div className="text-xs text-zinc-500">
                          {msg.timestamp.toLocaleTimeString()}
                          {msg.isStreaming && " • Streaming..."}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              navigator.clipboard.writeText(msg.content)
                            }
                            className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          {!msg.isStreaming && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInput(msg.content)}
                              className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {msg.role === "user" && (
                      <Avatar className="h-9 w-9 border border-zinc-700 bg-zinc-800 shrink-0">
                        <AvatarFallback className="bg-zinc-700 text-zinc-300">
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                </div>
              ))}

              {/* Error display */}
              {error && (
                <div className="flex items-start gap-4 justify-start">
                  <div className="relative w-10 h-10 border rounded-full flex flex-col justify-center items-center">
                    <Brain className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="bg-red-900/20 border border-red-800/50 p-4 rounded-xl rounded-bl-md flex items-center gap-3">
                    <X className="h-4 w-4 text-red-400" />
                    <div>
                      <span className="text-sm text-red-300">Error: {error}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={retryLastMessage}
                        className="ml-2 text-red-400 hover:text-red-300"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Retry
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-1" />
            </div>
          </div>

          {/* Enhanced File Attachments Preview */}
          {attachments.length > 0 && (
            <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/50 p-4">
              <div className="text-sm font-medium text-zinc-300 mb-3 flex items-center justify-between">
                <span>Attached Code Files ({attachments.length})</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {attachments.reduce((acc, file) => acc + file.size, 0)}{" "}
                    chars total
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAttachments([])}
                    className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    <Minus className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {attachments.map((file) => (
                  <EnhancedFilePreview
                    key={file.id}
                    file={{ ...file, type: "code" }}
                    onRemove={() => removeAttachment(file.id)}
                    compact={true}
                    onInsert={
                      onInsertCode
                        ? (code) => handleInsertCode(code)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Input Form */}
          <StreamingAIChatInput
            value={input}
            onChange={(value) => setInput(value)}
            onSend={handleSendMessage}
            onPaste={handlePaste}
            disabled={isLoading || isStreaming}
            inputRef={inputRef as React.RefObject<HTMLTextAreaElement>}
            onAttachClick={() => fileInputRef.current?.click()}
            chatMode={chatMode}
            isLoading={isLoading}
            isStreaming={isStreaming}
          />

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.html,.css,.json,.md,.txt,.sql,.sh,.php,.rb,.go,.rs,.swift,.kt,.dart,.r,.scala,.clj,.hs,.elm,.vue,.svelte"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              files.forEach((file) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const content = event.target?.result as string;
                  addFileAttachment(file.name, content, file.type);
                };
                reader.readAsText(file);
              });
              e.target.value = "";
            }}
          />
        </div>
      </>
    </TooltipProvider>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  // Only re-render if meaningful props change
  return (
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.activeFileName === nextProps.activeFileName &&
    prevProps.activeFileLanguage === nextProps.activeFileLanguage &&
    prevProps.theme === nextProps.theme &&
    // Only compare content length and line number to avoid constant re-renders
    prevProps.activeFileContent?.length === nextProps.activeFileContent?.length &&
    prevProps.cursorPosition?.line === nextProps.cursorPosition?.line &&
    // Compare function references (they should be stable with useCallback)
    prevProps.onClose === nextProps.onClose &&
    prevProps.onInsertCode === nextProps.onInsertCode &&
    prevProps.onRunCode === nextProps.onRunCode
  );
});