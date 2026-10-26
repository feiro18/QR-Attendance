# Admin dashboard setup

Admins use the same sign-in screen as students and teachers. After signing in, an active admin sees the **Admin** tab, where they can:

- View accounts and attendance records.
- Deactivate or reactivate student and teacher accounts.
- Create, edit, and delete events. Deleting an event also deletes its attendance records.

Admin access is assigned directly in Supabase; public registration cannot create admin accounts.

## Configure an existing Supabase project

1. In the Supabase Dashboard, open **SQL Editor** and run [`admin-migration.sql`](./admin-migration.sql).
2. Promote the first administrator by running the following query with that account's email:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'admin@school.edu';
   ```

3. Deploy the Edge Function from the repository root using the Supabase CLI:

   ```powershell
   supabase functions deploy admin-users
   ```

   The function uses Supabase's `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` Edge Function secrets. Never put the service-role key in the mobile app or commit it to source control.
4. Sign out and sign back in with the first admin account.

## New Supabase projects

Run [`schema.sql`](./schema.sql) in the SQL Editor, then deploy the same `admin-users` Edge Function. Promote the first admin with the SQL query above.
