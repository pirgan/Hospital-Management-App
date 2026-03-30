/**
 * ProtocolChunk model
 * Stores chunks of clinical protocol documents for the RAG (Retrieval-Augmented Generation) chatbot.
 *
 * How the RAG pipeline works:
 *   1. ingestProtocols.js reads .md files from data/clinical-protocols/,
 *      splits them into ~500-word chunks, and upserts each as a ProtocolChunk document.
 *   2. When a user asks the chatbot a question, aiController.protocolChatbot:
 *      a. Calls Haiku to extract search keywords from the question.
 *      b. Runs a MongoDB $text search across the `content` field to find relevant chunks.
 *      c. Passes the top 5 chunks as context to Sonnet to synthesise a cited answer.
 *
 * The $text index on `content` enables MongoDB's built-in full-text search,
 * which scores and ranks results by keyword frequency — no external vector DB needed.
 *
 * source     — the .md filename (e.g. "hypertension-management.md")
 * section    — the last heading seen before this chunk (e.g. "First-Line Treatment")
 * chunkIndex — position of this chunk within its source file (0-based)
 */
import mongoose from 'mongoose';

const protocolChunkSchema = new mongoose.Schema({
  source: { type: String, required: true },     // source filename
  section: { type: String },                    // section heading this chunk falls under
  chunkIndex: { type: Number, required: true }, // sequential index within the source file
  content: { type: String, required: true },    // the raw text of this chunk (~500 words)
  wordCount: { type: Number },                  // approximate word count for the chunk
  createdAt: { type: Date, default: Date.now },
});

// Full-text index on content — enables $text search queries with relevance scoring
protocolChunkSchema.index({ content: 'text' });

export default mongoose.model('ProtocolChunk', protocolChunkSchema);
