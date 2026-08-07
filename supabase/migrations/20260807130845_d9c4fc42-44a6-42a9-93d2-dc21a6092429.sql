-- locker-files: owner-scoped by first path segment = user id
CREATE POLICY "locker read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'locker-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "locker insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'locker-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "locker update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'locker-files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'locker-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "locker delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'locker-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- library-files: everyone signed in reads, staff writes
CREATE POLICY "library read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'library-files');
CREATE POLICY "library staff insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'library-files' AND (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "library staff update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'library-files' AND (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (bucket_id = 'library-files' AND (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "library staff delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'library-files' AND (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin')));