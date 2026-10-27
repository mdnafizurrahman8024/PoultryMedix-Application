-- The PDF ingestion pipeline stores 768-dimensional Gemini embeddings in documents.embedding.
-- This RPC keeps guest prescription scans on the same server-side vector search path.
create or replace function public.match_veterinary_docs(
  query_embedding extensions.vector(768),
  match_threshold float default 0.5,
  match_count int default 8
)
returns setof public.documents
language sql
stable
security definer
set search_path = public, extensions
as $$
  select document_row.*
  from public.documents as document_row
  where 1 - (document_row.embedding <=> query_embedding) >= match_threshold
  order by document_row.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 100);
$$;

revoke all on function public.match_veterinary_docs(extensions.vector, float, int) from public;
grant execute on function public.match_veterinary_docs(extensions.vector, float, int) to anon, authenticated;
