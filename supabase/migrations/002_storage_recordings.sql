-- Storage policies for the recordings bucket.
-- Run this in Supabase SQL Editor if you get "new row violates row-level security policy" on upload.
-- The bucket must exist first: create a PUBLIC bucket named "recordings" in Storage > Buckets.

-- Allow anon to INSERT (upload) into recordings bucket
create policy "Allow anon insert recordings"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'recordings');

-- Allow anon to SELECT (read) from recordings bucket (needed for public URL access)
create policy "Allow anon select recordings"
  on storage.objects for select
  to anon
  using (bucket_id = 'recordings');
