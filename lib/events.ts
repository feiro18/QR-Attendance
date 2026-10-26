import { supabase } from './supabase';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
};

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
};

export async function createEvent(
  event: Event
): Promise<{ error: string | null }> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: userError?.message ?? 'You must be signed in to create an event.' };
  }

  const { error } = await supabase.from('events').upsert(
    {
      event_code: event.eventId,
      title: event.title,
      start_time: event.start || null,
      end_time: event.end || null,
      created_by: user.id,
    },
    { onConflict: 'event_code' }
  );

  return { error: error?.message ?? null };
}

export async function getEventsByTeacher(teacherId: string): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  return error || !data ? [] : data as CloudEvent[];
}

export async function getEventByCode(code: string): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code)
    .maybeSingle();

  return error || !data ? null : data as CloudEvent;
}

export async function getAllEvents(): Promise<{ data: CloudEvent[]; error: string | null }> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });

  return { data: (data ?? []) as CloudEvent[], error: error?.message ?? null };
}

export async function saveAdminEvent(
  event: Pick<CloudEvent, 'id' | 'event_code' | 'title' | 'start_time' | 'end_time'> | Omit<CloudEvent, 'id' | 'created_by' | 'created_at'>
): Promise<{ error: string | null }> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: userError?.message ?? 'You must be signed in to manage events.' };
  }

  const values = {
    event_code: event.event_code,
    title: event.title,
    start_time: event.start_time,
    end_time: event.end_time,
  };
  if ('id' in event) {
    const { data, error } = await supabase
      .from('events')
      .update(values)
      .eq('id', event.id)
      .select('id')
      .maybeSingle();
    return {
      error: error?.message ?? (data ? null : 'Event was not found or cannot be edited.'),
    };
  }

  const { data, error } = await supabase
    .from('events')
    .insert({ ...values, created_by: user.id })
    .select('id')
    .single();
  return { error: error?.message ?? (data ? null : 'Event was not created.') };
}

export async function deleteAdminEvent(eventId: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .select('id')
    .maybeSingle();
  return { error: error?.message ?? (data ? null : 'Event was not found or cannot be deleted.') };
}