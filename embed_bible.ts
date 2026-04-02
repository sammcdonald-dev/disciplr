import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const rawKeys = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '';
const apiKeys = rawKeys.split(',').map((k) => k.trim()).filter(Boolean);
if (apiKeys.length === 0) {
  throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is required');
}
console.log(`🔑 Loaded ${apiKeys.length} API keys`);

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is required');
}

const BIBLE_PATH = path.resolve('./bible.json');
const MODEL_ID = process.env.MODEL_ID || 'gemini-embedding-001';

let currentKeyIndex = 0;
const exhaustedKeys = new Set<number>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedWithFallback(text: string): Promise<number[] | null> {
  const maxRetries = apiKeys.length + 1;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const keyIndex = currentKeyIndex % apiKeys.length;
    const genAI = new GoogleGenerativeAI(apiKeys[keyIndex]);
    const model = genAI.getGenerativeModel({ model: MODEL_ID });

    try {
      const result = await model.embedContent({
        content: { role: 'user', parts: [{ text }] },
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      });
      return result.embedding?.values ?? null;
    } catch (err: any) {
      if (err.status === 429) {
        console.warn(`⚠️ Key ${keyIndex + 1} rate limited, rotating...`);
        exhaustedKeys.add(keyIndex);
        currentKeyIndex++;

        if (exhaustedKeys.size >= apiKeys.length) {
          console.log('⏳ All keys exhausted, waiting 30s...');
          exhaustedKeys.clear();
          await sleep(30_000);
        }
        continue;
      }
      throw err;
    }
  }

  return null;
}

async function embedBible() {
  const db = new Client({ connectionString: POSTGRES_URL });
  await db.connect();

  const data = JSON.parse(fs.readFileSync(BIBLE_PATH, 'utf-8'));
  console.log(`📖 Loaded ${data.length} verses.`);

  let inserted = 0;
  let skipped = 0;

  for (const verse of data) {
    const { book, chapter, verse: verseNum, text } = verse;

    const existing = await db.query(
      `SELECT id FROM bible_verses WHERE book=$1 AND chapter=$2 AND verse=$3`,
      [book, chapter, verseNum],
    );

    if ((existing?.rowCount ?? 0) > 0) {
      skipped++;
      continue;
    }

    const embedding = await embedWithFallback(text);
    if (!embedding) {
      console.warn(`⚠️ No embedding for ${book} ${chapter}:${verseNum}, skipping`);
      continue;
    }

    const vector_literal = `[${embedding.join(',')}]`;
    await db.query(
      `INSERT INTO bible_verses (book, chapter, verse, text, embedding)
       VALUES ($1, $2, $3, $4, $5)`,
      [book, chapter, verseNum, text, vector_literal],
    );

    inserted++;
    if (inserted % 100 === 0) {
      console.log(`✅ ${inserted} inserted (${book} ${chapter}:${verseNum})`);
    }
  }

  await db.end();
  console.log(`\nDone! ${inserted} inserted, ${skipped} skipped (already in DB).`);
}

embedBible().catch((err) => {
  console.error('Error embedding Bible:', err);
  process.exit(1);
});
