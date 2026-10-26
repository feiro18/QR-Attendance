import { supabase } from './supabase';

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'student' | 'teacher' | 'admin';
  active: boolean;
  created_at: string;
};

export type AdminAttendance = {
  id: string;
  scanned_at: string;
  profiles: { full_name: string | null; email: string }[] | null;
  events: { title: string; event_code: string }[] | null;
};

export async function getAdminUsers(): Promise<{ data: AdminUser[]; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, active, created_at')
    .order('created_at', { ascending: false });

  return { data: (data ?? []) as AdminUser[], error: error?.message ?? null };
}

export async function getAdminAttendance(): Promise<{
  data: AdminAttendance[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, scanned_at, profiles(full_name, email), events(title, event_code)')
    .order('scanned_at', { ascending: false });

  return { data: (data ?? []) as AdminAttendance[], error: error?.message ?? null };
}

export async function setUserActive(
  userId: string,
  active: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.functions.invoke('admin-users', {
    body: { action: active ? 'reactivate' : 'deactivate', userId },
  });
  return { error: error?.message ?? null };
}
