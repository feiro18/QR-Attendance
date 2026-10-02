import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { signOut, useAuth } from '@/lib/auth';
import { getProfile, updateProfile, type Profile } from '@/lib/profiles';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draftName, setDraftName] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!user) return () => { active = false; };
      getProfile(user.id).then((result) => {
        if (!active) return;
        setProfile(result);
        setDraftName(result?.full_name ?? '');
      });
      return () => { active = false; };
    }, [user?.id])
  );

  const handleSaveName = async () => {
    if (!user || !draftName.trim()) {
      Alert.alert('Name required', 'Enter a name before saving.');
      return;
    }
    setLoading(true);
    const { error } = await updateProfile(user.id, { full_name: draftName.trim() });
    setLoading(false);
    if (error) {
      Alert.alert('Could not update profile', error);
      return;
    }
    setProfile((current) => current ? { ...current, full_name: draftName.trim() } : current);
    setEditing(false);
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Profile</Text>

      <View style={styles.infoSection}>
        <View style={[styles.roleBadge, profile?.role === 'teacher' && styles.teacherBadge]}>
          <Text style={styles.roleBadgeText}>
            {profile?.role === 'teacher' ? 'Teacher' : 'Student'}
          </Text>
        </View>

        <Text style={styles.label}>Name</Text>
        {editing ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.input}
              value={draftName}
              onChangeText={setDraftName}
              autoCapitalize="words"
              editable={!loading}
            />
            <Pressable style={styles.saveButton} onPress={handleSaveName} disabled={loading}>
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <Text style={styles.value}>{profile?.full_name || 'Name not set'}</Text>
            <Pressable onPress={() => setEditing(true)} accessibilityRole="button">
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile?.email ?? user?.email ?? '—'}</Text>
        <Text style={styles.label}>User ID</Text>
        <Text selectable style={styles.valueSmall}>{user?.id ?? '—'}</Text>
      </View>

      <AppButton
        title="Sign Out"
        icon="log-out-outline"
        onPress={handleSignOut}
        disabled={loading}
      />
    </View>
  );
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
  infoSection: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  teacherBadge: {
    backgroundColor: '#F8E8D5',
  },
  roleBadgeText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 8,
  },
  saveText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },
  editText: {
    color: COLORS.primary,
    fontWeight: '700',
    paddingLeft: 12,
  },
  value: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  valueSmall: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});
