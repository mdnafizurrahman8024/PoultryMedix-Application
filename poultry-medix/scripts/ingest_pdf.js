import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import axios from "axios";
import { PDFParse } from "pdf-parse";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} in .env`);
  }

  return value;
}

function splitText(text) {
  const chunks = [];
  const step = CHUNK_SIZE - CHUNK_OVERLAP;

  for (let start = 0; start < text.length; start += step) {
    const chunk = text.slice(start, start + CHUNK_SIZE).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (start + CHUNK_SIZE >= text.length) {
      break;
    }
  }

  return chunks;
}

async function extractPdfText(pdfPath) {
  const parser = new PDFParse({ data: await fs.readFile(pdfPath) });

  try {
    const result = await parser.getText();

    return result.text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } finally {
    await parser.destroy();
  }
}

async function main() {
  const inputPath = process.argv[2];

  if (!inputPath || inputPath === "--help" || inputPath === "-h") {
    console.log("Usage: node scripts/ingest_pdf.js <path-to-pdf>");
    process.exitCode = inputPath ? 0 : 1;
    return;
  }

  const pdfPath = path.resolve(process.cwd(), inputPath);
  const sourceFile = path.basename(pdfPath);
  const bookName = path.basename(pdfPath, path.extname(pdfPath));
  const text = await extractPdfText(pdfPath);

  if (!text) {
    throw new Error("The PDF contains no extractable text.");
  }

  const chunks = splitText(text);

  if (chunks.length === 0) {
    throw new Error("The PDF produced no text chunks.");
  }

  const geminiApiKey = requiredEnv("GEMINI_API_KEY");

  const rows = [];

  for (const [index, chunk] of chunks.entries()) {
    const result = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
      {
        content: { role: "user", parts: [{ text: chunk }] },
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
      { headers: { "content-type": "application/json", "x-goog-api-key": geminiApiKey } }
    );
    const embedding = result.data?.embedding?.values;

    if (
      !Array.isArray(embedding) ||
      embedding.length !== EMBEDDING_DIMENSIONS ||
      embedding.some((value) => !Number.isFinite(value))
    ) {
      throw new Error(
        `Gemini returned an invalid embedding for chunk ${index + 1}. ` +
          `Expected ${EMBEDDING_DIMENSIONS} dimensions.`
      );
    }

    rows.push({
      content: chunk,
      metadata: {
        book_name: bookName,
        source_file: sourceFile,
        chunk_index: index,
        chunk_count: chunks.length,
      },
      embedding,
    });

    console.log(`Embedded chunk ${index + 1}/${chunks.length}`);
  }

  const supabase = createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_ANON_KEY")
  );
  const { error } = await supabase.from("documents").insert(rows);

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  console.log(`Inserted ${rows.length} chunks from ${sourceFile}.`);
}

main().catch((error) => {
  console.error(`Ingestion failed: ${error.message}`);
  process.exitCode = 1;
});
