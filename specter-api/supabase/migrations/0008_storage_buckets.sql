-- Supabase Storage bucket for raw scraped HTML.
-- specter-api saves raw HTML to: scrape-raw-html/{domain}/{url_path}/{timestamp}.html
-- The path is stored in price_snapshots.raw_s3_key for later retrieval.
-- Bucket is private — all access goes through specter-api using the service_role key.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scrape-raw-html',
  'scrape-raw-html',
  false,
  10485760,   -- 10 MB per file (raw HTML is typically 50–300 KB; 10 MB is generous)
  ARRAY['text/html', 'text/plain', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Storage objects RLS:
-- The service_role key used by specter-api bypasses RLS automatically.
-- No public or authenticated-user policies are needed — the bucket is access-controlled
-- entirely through specter-api. The policy below is explicit documentation of intent.

CREATE POLICY "service_role_full_access"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'scrape-raw-html')
  WITH CHECK (bucket_id = 'scrape-raw-html');
