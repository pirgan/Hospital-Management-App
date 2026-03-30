/**
 * Protocol ingestion script
 * Reads all .md files from data/clinical-protocols/, splits them into ~500-word
 * chunks, and upserts each chunk into the ProtocolChunk MongoDB collection.
 *
 * Run once after first deploy, or whenever protocol files are added/updated:
 *   node src/scripts/ingestProtocols.js
 *
 * Why chunk at ~500 words?
 *   MongoDB's $text search works best on focused, topic-specific passages.
 *   Chunks that are too small lose context; chunks that are too large dilute
 *   the relevance score. 500 words balances specificity and context.
 *
 * The chunkText function tracks the current section heading so each chunk
 * knows which part of the protocol it came from — this is used in citations.
 *
 * Upsert (findOneAndUpdate with upsert:true) means the script is idempotent —
 * re-running it updates existing chunks rather than creating duplicates.
 */
import 'dotenv/config';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import ProtocolChunk from '../models/ProtocolChunk.js';

// __dirname equivalent for ES modules (not available natively in ESM)
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTOCOLS_DIR = join(__dirname, '../data/clinical-protocols');
const CHUNK_WORD_TARGET = 500; // target chunk size in words

/**
 * Splits a protocol document into chunks of approximately CHUNK_WORD_TARGET words.
 * Tracks heading lines (starting with #) to record which section each chunk belongs to.
 * A new chunk is created when the word count reaches the target, or at the end of the file.
 *
 * @param {string} text   - Raw markdown content of the protocol file
 * @param {string} source - Filename, used as the `source` field on each chunk
 * @returns {Array} Array of chunk objects ready to upsert into ProtocolChunk
 */
function chunkText(text, source) {
  const lines = text.split('\n');
  const chunks = [];
  let current = [];          // lines accumulated for the current chunk
  let currentSection = 'Introduction';
  let wordCount = 0;
  let chunkIndex = 0;

  for (const line of lines) {
    // Update section name when a heading line is encountered
    if (line.startsWith('#')) {
      currentSection = line.replace(/^#+\s*/, '').trim();
    }

    current.push(line);
    wordCount += line.split(/\s+/).filter(Boolean).length;

    // Flush the chunk when it reaches the target word count
    if (wordCount >= CHUNK_WORD_TARGET) {
      chunks.push({
        source,
        section: currentSection,
        chunkIndex: chunkIndex++,
        content: current.join('\n').trim(),
        wordCount,
      });
      current = [];
      wordCount = 0;
    }
  }

  // Flush any remaining content (final chunk that didn't reach the target size)
  // Only create a chunk if there's meaningful content (>20 words)
  if (current.length && wordCount > 20) {
    chunks.push({
      source,
      section: currentSection,
      chunkIndex: chunkIndex++,
      content: current.join('\n').trim(),
      wordCount,
    });
  }

  return chunks;
}

/**
 * Main ingestion function — connects to MongoDB, reads all .md protocol files,
 * chunks each one, and upserts the chunks into the ProtocolChunk collection.
 */
async function ingest() {
  await connectDB();

  const files = (await readdir(PROTOCOLS_DIR)).filter((f) => f.endsWith('.md'));
  console.log(`Found ${files.length} protocol files`);

  let total = 0;
  for (const file of files) {
    const text = await readFile(join(PROTOCOLS_DIR, file), 'utf8');
    const chunks = chunkText(text, file);

    for (const chunk of chunks) {
      // Upsert by source + chunkIndex so re-running the script updates existing chunks
      await ProtocolChunk.findOneAndUpdate(
        { source: chunk.source, chunkIndex: chunk.chunkIndex },
        chunk,
        { upsert: true, new: true }
      );
    }

    console.log(`  ${file}: ${chunks.length} chunks`);
    total += chunks.length;
  }

  console.log(`Ingestion complete — ${total} chunks upserted`);
  process.exit(0);
}

ingest().catch((err) => {
  console.error(err);
  process.exit(1);
});
