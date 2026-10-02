import { supabase } from './supabase';
import { getEventByCode } from './events';
import { parseQRPayload } from './qr';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  attendeeCount: number;
  attendees: { studentId: string; studentName: string | null; scannedAt: string }[];
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);
  if (!parsed.ok) return { success: false, message: parsed.message };
  const payload = parsed.payload;

  const now = Date.now();
  const start = payload.start ? new Date(payload.start).getTime() : null;
  const end = payload.end ? new Date(payload.end).getTime() : null;
  if (start !== null && Number.isFinite(start) && now < start) {
    return { success: false, message: 'Event has not started yet.' };
  }
  if (end !== null && Number.isFinite(end) && now > end) {
    return { success: false, message: 'Event has already ended.' };
  }

  const title = payload.title ?? payload.event;
  let event = await getEventByCode(payload.event);
  if (!event) {
    const { data, error } = await supabase
      .from('events')
      .insert({
        event_code: payload.event,
        title,
        start_time: payload.start ?? null,
        end_time: payload.end ?? null,
      })
      .select('id, title')
      .single();

    if (error || !data) {
      return { success: false, message: 'Could not create event.' };
    }
    event = { ...data, event_code: payload.event, start_time: null, end_time: null, created_by: null, created_at: '' };
  }

  const { error } = await supabase.from('attendance').insert({
    student_id: studentId,
    event_id: event.id,
  });

  if (error?.code === '23505') {
    return {
      success: false,
      message: 'Already registered for this event.',
      eventTitle: event.title,
    };
  }
  if (error) return { success: false, message: error.message };

  return { success: true, message: 'Attendance recorded!', eventTitle: event.title };
}

export async function getAttendanceHistory(studentId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, scanned_at, events ( event_code, title )')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    eventId: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? 'Unknown event',
    scannedAt: row.scanned_at,
  }));
}

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError || !events?.length) return [];
  const eventIds = events.map((event: any) => event.id);

  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance')
    .select('student_id, scanned_at, event_id, profiles ( full_name, email )')
    .in('event_id', eventIds)
    .order('scanned_at', { ascending: false });

  if (attendanceError || !attendance) return [];

  return events.map((event: any) => {
    const rows = attendance.filter((row: any) => row.event_id === event.id);
    return {
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,
      attendeeCount: rows.length,
      attendees: rows.map((row: any) => ({
        studentId: row.student_id,
        studentName: row.profiles?.full_name ?? null,
        scannedAt: row.scanned_at,
      })),
    };
  });
}

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, event_code, title')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (error || !events?.length) return [];
  const eventIds = events.map((event: any) => event.id);
  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attendanceError || !attendance) return [];
  const counts: Record<string, number> = {};
  attendance.forEach((row: any) => {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
  });

  return events.map((event: any) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    attendeeCount: counts[event.id] ?? 0,
  }));
}