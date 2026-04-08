/**
 * Downloads KJV Bible from aruljohn/Bible-kjv on GitHub
 * and writes a flat bible.json in the format embed_bible.ts expects:
 * [{ book, chapter, verse, text }, ...]
 */

import fs from 'node:fs';
import path from 'node:path';

const BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song Of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
  'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts',
  'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
  'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation',
];

const BASE_URL = 'https://cdn.jsdelivr.net/gh/aruljohn/Bible-niv';

interface SourceVerse {
  verse: string;
  text: string;
}

interface SourceChapter {
  chapter: string;
  verses: SourceVerse[];
}

interface SourceBook {
  book: string;
  chapters: SourceChapter[];
}

interface FlatVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

async function downloadBible() {
  const allVerses: FlatVerse[] = [];
  let totalBooks = 0;

  for (const bookName of BOOKS) {
    const url = `${BASE_URL}/${encodeURIComponent(bookName)}.json`;
    console.log(`Downloading ${bookName}...`);

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to download ${bookName}: ${res.status}`);
      continue;
    }

    const data: SourceBook = await res.json();

    for (const chapter of data.chapters) {
      for (const verse of chapter.verses) {
        allVerses.push({
          book: data.book,
          chapter: parseInt(chapter.chapter, 10),
          verse: parseInt(verse.verse, 10),
          text: verse.text,
        });
      }
    }

    totalBooks++;
  }

  const outPath = path.resolve('./bible.json');
  fs.writeFileSync(outPath, JSON.stringify(allVerses, null, 2));
  console.log(`\nDone! ${totalBooks} books, ${allVerses.length} verses written to ${outPath}`);
}

downloadBible().catch((err) => {
  console.error('Failed to download Bible:', err);
  process.exit(1);
});
