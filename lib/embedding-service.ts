import { pipeline } from '@xenova/transformers';

// Singleton for the embedding model
let embedder: any = null;

export async function getEmbedder() {
  if (!embedder) {
    console.log('🧠 Loading embedding model...');
    // Use a lightweight model optimized for code
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('✅ Embedding model loaded');
  }
  return embedder;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = await getEmbedder();
    const output = await model(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Return zero vector as fallback
    return new Array(384).fill(0);
  }
}

export function createCodeContext(
  fileContent: string, 
  cursorLine: number, 
  cursorColumn: number,
  language: string,
  framework: string
): string {
  const lines = fileContent.split('\n');
  const contextRadius = 5; // Smaller radius for focused context
  
  const startLine = Math.max(0, cursorLine - contextRadius);
  const endLine = Math.min(lines.length, cursorLine + contextRadius);
  
  const contextLines = lines.slice(startLine, endLine);
  const currentLine = lines[cursorLine] || '';
  
  // Create a focused context string for embedding
  const context = [
    `Language: ${language}`,
    `Framework: ${framework}`,
    `Context:`,
    ...contextLines,
    `Cursor at line ${cursorLine}, column ${cursorColumn}`,
    `Current line: ${currentLine}`
  ].join('\n');
  
  return context;
}

export function createChatContext(
  message: string,
  mode: string,
  history?: any[]
): string {
  // Create context for chat messages
  const recentHistory = (history || []).slice(-3); // Last 3 messages for context
  
  const context = [
    `Mode: ${mode}`,
    `Recent conversation:`,
    ...recentHistory.map(msg => `${msg.role}: ${msg.content.substring(0, 200)}`),
    `Current message: ${message}`
  ].join('\n');
  
  return context;
}

export function calculateSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) return 0;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }
  
  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}