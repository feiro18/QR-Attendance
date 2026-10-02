import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { getProfile, type Role } from '@/lib/profiles';

export default function HistoryScreen() {
  const [role, setRole] = useState<Role | null>(null);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const load = useCallback(async () => {
    if (!user) {
      setStudentRecords([]);
      setTeacherEvents([]);
      setRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const profile = await getProfile(user.id);
      const currentRole = profile?.role ?? 'student';
      setRole(currentRole);

      if (currentRole === 'teacher') {
        setTeacherEvents(await getTeacherEventAttendance(user.id));
        setStudentRecords([]);
      } else {
        setStudentRecords(await getAttendanceHistory(user.id));
        setTeacherEvents([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {role === 'teacher' ? 'Event Attendance' : 'Attendance History'}
      </Text>

      {loading ? (
        <Text style={styles.empty}>Loading records...</Text>
      ) : role === 'teacher' ? (
        teacherEvents.length === 0 ? (
          <Text style={styles.empty}>No events yet. Create an event from the Teacher tab.</Text>
        ) : (
          <FlatList
            data={teacherEvents}
            keyExtractor={(item) => item.eventId}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.eventHeading}>
                  <Text style={styles.eventTitle}>{item.title}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{item.attendeeCount}</Text>
                  </View>
                </View>
                <Text style={styles.eventMeta}>{item.eventCode}</Text>
                {item.startTime && <Text style={styles.eventMeta}>Starts {formatDate(item.startTime)}</Text>}
                {item.attendees.length > 0 ? (
                  <View style={styles.attendeeList}>
                    {item.attendees.map((attendee) => (
                      <View key={attendee.studentId} style={styles.attendeeRow}>
                        <Text style={styles.attendeeName}>
                          {attendee.studentName || shortId(attendee.studentId)}
                        </Text>
                        <Text style={styles.attendeeTime}>{formatDate(attendee.scannedAt)}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noAttendees}>No scans recorded yet.</Text>
                )}
              </View>
            )}
          />
        )
      ) : studentRecords.length === 0 ? (
        <Text style={styles.empty}>No records yet. Scan a QR code to register your attendance.</Text>
      ) : (
        <FlatList
          data={studentRecords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.eventTitle}>{item.eventTitle}</Text>
              <Text style={styles.eventMeta}>{item.eventId}</Text>
              <Text style={styles.eventMeta}>{formatDate(item.scannedAt)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

function shortId(id: string) {
  return id ? `…${id.slice(-8)}` : 'unknown';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  empty: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: 24,
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  eventHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  countBadge: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    marginLeft: 8,
  },
  countText: {
    color: COLORS.success,
    fontSize: 14,
    fontWeight: '700',
  },
  attendeeList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 12,
    paddingTop: 8,
  },
  attendeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  attendeeName: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginRight: 8,
  },
  attendeeTime: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  noAttendees: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 12,
  },
});
