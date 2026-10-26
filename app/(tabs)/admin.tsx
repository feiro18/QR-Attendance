import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  getAdminAttendance,
  getAdminUsers,
  setUserActive,
  type AdminAttendance,
  type AdminUser,
} from '@/lib/admin';
import { deleteAdminEvent, getAllEvents, saveAdminEvent, type CloudEvent } from '@/lib/events';
import { getProfile } from '@/lib/profiles';

type Section = 'users' | 'attendance' | 'events';

export default function AdminScreen() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState<Section>('users');
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [attendance, setAttendance] = useState<AdminAttendance[]>([]);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [eventCode, setEventCode] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const loadSection = useCallback(async (activeSection: Section) => {
    setLoading(true);
    setError(null);
    try {
      if (activeSection === 'users') {
        const result = await getAdminUsers();
        if (result.error) setError(result.error);
        else setUsers(result.data);
      } else if (activeSection === 'attendance') {
        const result = await getAdminAttendance();
        if (result.error) setError(result.error);
        else setAttendance(result.data);
      } else {
        const result = await getAllEvents();
        if (result.error) setError(result.error);
        else setEvents(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load admin data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setCheckingAccess(true);
      setError(null);
      if (!user) {
        setIsAdmin(false);
        setCheckingAccess(false);
        return () => { active = false; };
      }

      getProfile(user.id)
        .then((profile) => {
          if (!active) return;
          setIsAdmin(profile?.role === 'admin' && profile.active);
          setCheckingAccess(false);
          if (profile?.role === 'admin' && profile.active) {
            void loadSection(section);
          }
        })
        .catch((err) => {
          if (!active) return;
          setError(err instanceof Error ? err.message : 'Could not verify admin access.');
          setCheckingAccess(false);
        });

      return () => { active = false; };
    }, [user?.id, section, loadSection])
  );

  const handleSetUserActive = (target: AdminUser) => {
    const nextActive = !target.active;
    Alert.alert(
      nextActive ? 'Reactivate account?' : 'Deactivate account?',
      `${target.full_name || target.email} will ${nextActive ? 'be able to sign in again' : 'no longer be able to sign in'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: nextActive ? 'Reactivate' : 'Deactivate',
          style: nextActive ? 'default' : 'destructive',
          onPress: async () => {
            setLoading(true);
            setError(null);
            try {
              const result = await setUserActive(target.id, nextActive);
              if (result.error) {
                setError(`Could not update account: ${result.error}`);
                return;
              }
              setUsers((current) => current.map((item) =>
                item.id === target.id ? { ...item, active: nextActive } : item
              ));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not update account.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const resetEventForm = () => {
    setEditingEventId(null);
    setEventCode('');
    setEventTitle('');
    setEventStart('');
    setEventEnd('');
  };

  const handleSaveEvent = async () => {
    setError(null);
    if (!eventCode.trim() || !eventTitle.trim()) {
      setError('Event title and code are required.');
      return;
    }
    const start = eventStart.trim() || null;
    const end = eventEnd.trim() || null;
    if (start && Number.isNaN(Date.parse(start))) {
      setError('Start time must be a valid date and time.');
      return;
    }
    if (end && Number.isNaN(Date.parse(end))) {
      setError('End time must be a valid date and time.');
      return;
    }
    if (start && end && Date.parse(end) <= Date.parse(start)) {
      setError('End time must be after start time.');
      return;
    }

    setLoading(true);
    try {
      const event = editingEventId
        ? {
            id: editingEventId,
            event_code: eventCode.trim(),
            title: eventTitle.trim(),
            start_time: start ? new Date(start).toISOString() : null,
            end_time: end ? new Date(end).toISOString() : null,
          }
        : {
            event_code: eventCode.trim(),
            title: eventTitle.trim(),
            start_time: start ? new Date(start).toISOString() : null,
            end_time: end ? new Date(end).toISOString() : null,
            created_by: null,
            created_at: '',
          };
      const result = await saveAdminEvent(event);
      if (result.error) {
        setError(`Could not save event: ${result.error}`);
        return;
      }
      resetEventForm();
      await loadSection('events');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save event.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = (event: CloudEvent) => {
    Alert.alert(
      'Delete event?',
      `Delete "${event.title}"? Attendance records for this event will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setError(null);
            try {
              const result = await deleteAdminEvent(event.id);
              if (result.error) {
                setError(`Could not delete event: ${result.error}`);
                return;
              }
              setEvents((current) => current.filter((item) => item.id !== event.id));
              if (editingEventId === event.id) resetEventForm();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not delete event.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (checkingAccess) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.muted}>Checking admin access...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.stateContainer}>
        <Ionicons name="lock-closed-outline" size={32} color={COLORS.textSecondary} />
        <Text style={styles.title}>Administrators Only</Text>
        <Text style={styles.muted}>An administrator account is required to manage this app.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text style={styles.muted}>Manage accounts, attendance, and events.</Text>

      <View style={styles.sectionRow}>
        {(['users', 'attendance', 'events'] as const).map((item) => (
          <Pressable
            key={item}
            style={[styles.sectionButton, section === item && styles.sectionButtonActive]}
            onPress={() => setSection(item)}
          >
            <Text style={[styles.sectionButtonText, section === item && styles.sectionButtonTextActive]}>
              {item === 'users' ? 'Users' : item === 'attendance' ? 'Attendance' : 'Events'}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {loading && <ActivityIndicator color={COLORS.primary} style={styles.loader} />}

      {section === 'users' && (
        <View>
          <Text style={styles.cardTitle}>Accounts</Text>
          {users.length === 0 && !loading ? <Text style={styles.muted}>No accounts found.</Text> : null}
          {users.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.userName}>{item.full_name || 'Name not set'}</Text>
              <Text style={styles.detail}>{item.email}</Text>
              <Text style={styles.detail}>
                {capitalize(item.role)} · {item.active ? 'Active' : 'Deactivated'}
              </Text>
              {item.role !== 'admin' && (
                <Pressable
                  style={[styles.actionButton, !item.active && styles.reactivateButton]}
                  onPress={() => handleSetUserActive(item)}
                  disabled={loading}
                >
                  <Text style={styles.actionButtonText}>{item.active ? 'Deactivate' : 'Reactivate'}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {section === 'attendance' && (
        <View>
          {attendance.length === 0 && !loading ? <Text style={styles.muted}>No attendance records found.</Text> : null}
          {attendance.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.userName}>{item.profiles?.[0]?.full_name || item.profiles?.[0]?.email || 'Unknown student'}</Text>
              <Text style={styles.detail}>{item.events?.[0]?.title || 'Unknown event'} ({item.events?.[0]?.event_code || '—'})</Text>
              <Text style={styles.detail}>{new Date(item.scanned_at).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}

      {section === 'events' && (
        <View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{editingEventId ? 'Edit event' : 'Create event'}</Text>
            <TextInput
              style={styles.input}
              value={eventTitle}
              onChangeText={setEventTitle}
              placeholder="Event title"
              placeholderTextColor={COLORS.textSecondary}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              value={eventCode}
              onChangeText={setEventCode}
              placeholder="Event code"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="characters"
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              value={eventStart}
              onChangeText={setEventStart}
              placeholder="Start time (optional, e.g. 2026-10-25T09:00)"
              placeholderTextColor={COLORS.textSecondary}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              value={eventEnd}
              onChangeText={setEventEnd}
              placeholder="End time (optional, e.g. 2026-10-25T10:00)"
              placeholderTextColor={COLORS.textSecondary}
              editable={!loading}
            />
            <Pressable style={styles.primaryButton} onPress={handleSaveEvent} disabled={loading}>
              <Text style={styles.primaryButtonText}>{editingEventId ? 'Save Changes' : 'Create Event'}</Text>
            </Pressable>
            {editingEventId && (
              <Pressable style={styles.secondaryButton} onPress={resetEventForm}>
                <Text style={styles.secondaryButtonText}>Cancel Edit</Text>
              </Pressable>
            )}
          </View>
          {events.length === 0 && !loading ? <Text style={styles.muted}>No events found.</Text> : null}
          {events.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.userName}>{item.title}</Text>
              <Text style={styles.detail}>{item.event_code}</Text>
              {item.start_time && <Text style={styles.detail}>Starts {new Date(item.start_time).toLocaleString()}</Text>}
              <View style={styles.eventActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    setEditingEventId(item.id);
                    setEventCode(item.event_code);
                    setEventTitle(item.title);
                    setEventStart(toLocalDateTime(item.start_time));
                    setEventEnd(toLocalDateTime(item.end_time));
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={() => handleDeleteEvent(item)} disabled={loading}>
                  <Text style={styles.actionButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toLocalDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 40 },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  muted: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20 },
  sectionRow: { flexDirection: 'row', marginVertical: 20, gap: 8 },
  sectionButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  sectionButtonActive: { backgroundColor: COLORS.primary },
  sectionButtonText: { color: COLORS.textPrimary, fontWeight: '600' },
  sectionButtonTextActive: { color: COLORS.textOnPrimary },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  userName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  detail: { color: COLORS.textSecondary, fontSize: 13, marginTop: 3 },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 12,
  },
  primaryButtonText: { color: COLORS.textOnPrimary, fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 10,
  },
  secondaryButtonText: { color: COLORS.textPrimary, fontWeight: '600' },
  actionButton: {
    backgroundColor: '#B33A3A',
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 12,
  },
  reactivateButton: { backgroundColor: COLORS.primary },
  actionButtonText: { color: '#FFFFFF', fontWeight: '700' },
  eventActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  error: {
    color: '#B42318',
    backgroundColor: '#FEE4E2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  loader: { marginBottom: 12 },
});
