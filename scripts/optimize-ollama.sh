#!/bin/bash

# Optimize Ollama for faster responses
echo "🚀 Optimizing Ollama for better performance..."

# Set environment variables for better performance
export OLLAMA_NUM_PARALLEL=2          # Process 2 requests in parallel
export OLLAMA_MAX_LOADED_MODELS=2     # Keep 2 models in memory
export OLLAMA_FLASH_ATTENTION=1       # Enable flash attention (if supported)
export OLLAMA_NUM_GPU=1               # Use GPU if available

# Pull optimized models
echo "📥 Pulling optimized models..."
ollama pull deepseek-coder:1.3b       # Fastest for code
ollama pull starcoder2:3b             # Good balance
ollama pull phi3:mini                 # Microsoft's efficient model

# Pre-load the model to avoid cold start
echo "🔥 Pre-loading model..."
ollama run deepseek-coder:1.3b "console.log('hello')" > /dev/null 2>&1

echo "✅ Ollama optimization complete!"
echo ""
echo "💡 Tips for better performance:"
echo "   - Use deepseek-coder:1.3b for fastest responses"
echo "   - Keep prompts under 1000 characters"
echo "   - Use caching for repeated queries"
echo "   - Enable streaming for better UX"