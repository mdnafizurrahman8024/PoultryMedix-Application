import dotenv from 'dotenv'
import process from 'node:process'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const geminiKey = process.env.GEMINI_API_KEY
const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001'

for (const [key, value] of Object.entries({ SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: serviceKey, GEMINI_API_KEY: geminiKey })) {
  if (!value) throw new Error(`Missing ${key}; document re-embedding requires server-side credentials.`)
}

async function embed(content) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
    body: JSON.stringify({ content: { parts: [{ text: content }] }, taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: 768 }),
  })
  if (!response.ok) throw new Error(`Gemini embedding failed (${response.status}): ${await response.text()}`)
  const values = (await response.json()).embedding?.values
  if (!Array.isArray(values) || values.length !== 768) throw new Error('Gemini returned an unexpected embedding dimension.')
  return values
}

async function main() {
  let start = 0
  let updated = 0
  const pageSize = 100
  while (true) {
    const listResponse = await fetch(`${supabaseUrl}/rest/v1/documents?select=id,content&order=id.asc&limit=${pageSize}&offset=${start}`, {
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
    })
    if (!listResponse.ok) throw new Error(`Could not read documents (${listResponse.status}): ${await listResponse.text()}`)
    const rows = await listResponse.json()
    if (!rows.length) break
    for (const row of rows) {
      if (!row.id || typeof row.content !== 'string' || !row.content.trim()) continue
      const embedding = await embed(row.content)
      const updateResponse = await fetch(`${supabaseUrl}/rest/v1/documents?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: {
          apikey: serviceKey,
          authorization: `Bearer ${serviceKey}`,
          'content-type': 'application/json',
          prefer: 'return=minimal',
        },
        body: JSON.stringify({ embedding }),
      })
      if (!updateResponse.ok) throw new Error(`Could not update document ${row.id} (${updateResponse.status}): ${await updateResponse.text()}`)
      updated += 1
      console.log(`Re-embedded ${updated} document chunks`)
    }
    start += rows.length
  }
  console.log(`Finished: re-embedded ${updated} document chunks with ${embeddingModel}.`)
}

main().catch((error) => {
  console.error(`Document re-embedding failed: ${error.message}`)
  process.exitCode = 1
})
