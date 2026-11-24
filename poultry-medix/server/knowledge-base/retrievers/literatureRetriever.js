/**
 * Scientific literature retriever querying PubMed (NCBI eUtils) and Europe PMC REST APIs.
 * Grounded in peer-reviewed veterinary medicine literature with timeout protection.
 */

const PUBMED_ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi'
const PUBMED_ESUMMARY_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi'
const EUROPE_PMC_URL = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search'

const DEFAULT_TIMEOUT_MS = 6000

export async function searchPubMedArticles(term, maxResults = 3) {
  if (!term || typeof term !== 'string') return []
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const searchQuery = new URLSearchParams({
      db: 'pubmed',
      term: `(${term}) AND (poultry[Title/Abstract] OR chicken[Title/Abstract] OR avian[Title/Abstract])`,
      retmode: 'json',
      retmax: String(maxResults),
      sort: 'pub_date',
    })

    const searchResponse = await fetch(`${PUBMED_ESEARCH_URL}?${searchQuery.toString()}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PoultryMedix-Clinical-RAG/1.0' },
    })

    if (!searchResponse.ok) return []
    const searchData = await searchResponse.json()
    const idList = searchData?.esearchresult?.idlist || []
    if (idList.length === 0) return []

    const summaryQuery = new URLSearchParams({
      db: 'pubmed',
      id: idList.join(','),
      retmode: 'json',
    })

    const summaryResponse = await fetch(`${PUBMED_ESUMMARY_URL}?${summaryQuery.toString()}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PoultryMedix-Clinical-RAG/1.0' },
    })

    if (!summaryResponse.ok) return []
    const summaryData = await summaryResponse.json()
    const result = summaryData?.result || {}

    return idList.map((id) => {
      const article = result[id] || {}
      return {
        id: `PMID:${id}`,
        title: article.title || 'Untitled Poultry Research',
        source: article.source || 'PubMed Central',
        pubDate: article.pubdate || '',
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        provider: 'PubMed NCBI',
      }
    })
  } catch (error) {
    console.warn('[knowledge-base] PubMed retrieval omitted or timed out:', error?.message)
    return []
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function searchEuropePmcArticles(query, maxResults = 2) {
  if (!query || typeof query !== 'string') return []

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const params = new URLSearchParams({
      query: `${query} AND (poultry OR avian OR broiler OR layer) AND (AMR OR antibiotic OR disease)`,
      format: 'json',
      pageSize: String(maxResults),
      resultType: 'lite',
    })

    const response = await fetch(`${EUROPE_PMC_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PoultryMedix-Clinical-RAG/1.0' },
    })

    if (!response.ok) return []
    const data = await response.json()
    const list = data?.resultList?.result || []

    return list.map((item) => ({
      id: `PMC:${item.id}`,
      title: item.title,
      source: item.journalTitle || 'Europe PMC',
      pubDate: item.pubYear || '',
      url: `https://europepmc.org/article/${item.source}/${item.id}`,
      provider: 'Europe PMC',
    }))
  } catch (error) {
    console.warn('[knowledge-base] Europe PMC retrieval omitted or timed out:', error?.message)
    return []
  } finally {
    clearTimeout(timeoutId)
  }
}
