-- Insert a storage bucket for events
insert into storage.buckets (id, name, public)
values ('events', 'events', true)
on conflict (id) do nothing;

-- Policies for the 'events' bucket
create policy "Images are publicly accessible"
on storage.objects for select
to public
using ( bucket_id = 'events' );

create policy "Admins can upload images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'events' AND
  public.has_role(auth.uid(), 'admin')
);

create policy "Admins can update images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'events' AND
  public.has_role(auth.uid(), 'admin')
);

create policy "Admins can delete images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'events' AND
  public.has_role(auth.uid(), 'admin')
);
