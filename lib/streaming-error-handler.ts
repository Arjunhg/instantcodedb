// Error handling utilities for streaming operations
export class StreamingError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'StreamingError';
  }
}

export const StreamingErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  PARSE_ERROR: 'PARSE_ERROR',
  ABORT_ERROR: 'ABORT_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  MODEL_ERROR: 'MODEL_ERROR',
} as const;

export class StreamingErrorHandler {
  private retryAttempts = new Map<string, number>();
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  /**
   * Handle streaming errors with automatic retry logic
   */
  async handleError(
    error: Error,
    context: string,
    retryFn?: () => Promise<void>
  ): Promise<{
    shouldRetry: boolean;
    userMessage: string;
    technicalMessage: string;
  }> {
    const attempts = this.retryAttempts.get(context) || 0;
    
    // Determine error type and recovery strategy
    const errorInfo = this.categorizeError(error);
    
    // Update retry count
    this.retryAttempts.set(context, attempts + 1);
    
    // Determine if we should retry
    const shouldRetry = errorInfo.recoverable && 
                       attempts < this.maxRetries && 
                       retryFn !== undefined;

    // Auto-retry for recoverable errors
    if (shouldRetry && retryFn) {
      console.log(`Retrying ${context} (attempt ${attempts + 1}/${this.maxRetries})`);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempts + 1)));
      
      try {
        await retryFn();
        // Success - reset retry count
        this.retryAttempts.delete(context);
        return {
          shouldRetry: false,
          userMessage: "Connection restored",
          technicalMessage: `Retry successful for ${context}`,
        };
      } catch (retryError) {
        // Retry failed, will be handled in next call
        return this.handleError(retryError as Error, context, retryFn);
      }
    }

    // Reset retry count if max attempts reached
    if (attempts >= this.maxRetries) {
      this.retryAttempts.delete(context);
    }

    return {
      shouldRetry: false,
      userMessage: errorInfo.userMessage,
      technicalMessage: errorInfo.technicalMessage,
    };
  }

  /**
   * Categorize error and provide appropriate messages
   */
  private categorizeError(error: Error): {
    code: string;
    recoverable: boolean;
    userMessage: string;
    technicalMessage: string;
  } {
    // Network/Connection errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        code: StreamingErrorCodes.NETWORK_ERROR,
        recoverable: true,
        userMessage: "Connection lost. Retrying...",
        technicalMessage: `Network error: ${error.message}`,
      };
    }

    // Abort errors (user cancelled)
    if (error.name === 'AbortError') {
      return {
        code: StreamingErrorCodes.ABORT_ERROR,
        recoverable: false,
        userMessage: "Request cancelled",
        technicalMessage: "Stream was aborted by user",
      };
    }

    // Timeout errors
    if (error.message.includes('timeout')) {
      return {
        code: StreamingErrorCodes.TIMEOUT,
        recoverable: true,
        userMessage: "Request timed out. Trying again...",
        technicalMessage: `Timeout error: ${error.message}`,
      };
    }

    // Parse errors (malformed response)
    if (error.name === 'SyntaxError' || error.message.includes('JSON')) {
      return {
        code: StreamingErrorCodes.PARSE_ERROR,
        recoverable: true,
        userMessage: "Received invalid response. Retrying...",
        technicalMessage: `Parse error: ${error.message}`,
      };
    }

    // Server errors (5xx)
    if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
      return {
        code: StreamingErrorCodes.SERVER_ERROR,
        recoverable: true,
        userMessage: "Server temporarily unavailable. Retrying...",
        technicalMessage: `Server error: ${error.message}`,
      };
    }

    // Model/AI specific errors
    if (error.message.includes('model') || error.message.includes('ollama')) {
      return {
        code: StreamingErrorCodes.MODEL_ERROR,
        recoverable: true,
        userMessage: "AI model temporarily unavailable. Please try again.",
        technicalMessage: `Model error: ${error.message}`,
      };
    }

    // Generic error
    return {
      code: 'UNKNOWN_ERROR',
      recoverable: false,
      userMessage: "An unexpected error occurred. Please try again.",
      technicalMessage: `Unknown error: ${error.message}`,
    };
  }

  /**
   * Reset retry count for a context
   */
  resetRetries(context: string): void {
    this.retryAttempts.delete(context);
  }

  /**
   * Get current retry count for a context
   */
  getRetryCount(context: string): number {
    return this.retryAttempts.get(context) || 0;
  }

  /**
   * Clear all retry counts
   */
  clearAllRetries(): void {
    this.retryAttempts.clear();
  }
}

// Global error handler instance
export const streamingErrorHandler = new StreamingErrorHandler();

/**
 * Utility function to wrap streaming operations with error handling
 */
export async function withStreamingErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  onError?: (error: Error) => void
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const errorInfo = await streamingErrorHandler.handleError(
      error as Error,
      context
    );
    
    if (onError) {
      onError(error as Error);
    }
    
    console.error(`Streaming error in ${context}:`, errorInfo.technicalMessage);
    throw new StreamingError(
      errorInfo.userMessage,
      errorInfo.technicalMessage,
      true
    );
  }
}

/**
 * Create a timeout wrapper for streaming operations
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${context} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}