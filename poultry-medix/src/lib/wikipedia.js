export async function searchWikipedia(query, language, signal) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '0',
    gsrlimit: '1',
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    format: 'json',
    origin: '*',
  })
  const response = await fetch(`https://${language}.wikipedia.org/w/api.php?${params}`, { signal })
  if (!response.ok) throw new Error(`Wikipedia search failed with status ${response.status}`)

  const result = await response.json()
  const page = Object.values(result.query?.pages ?? {})[0]
  if (!page?.extract?.trim()) return null

  return {
    title: page.title,
    extract: page.extract,
    url: `https://${language}.wikipedia.org/?curid=${page.pageid}`,
  }
}
