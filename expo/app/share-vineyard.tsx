import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Mail, Users, Share2, Trash2, Shield, HardHat, User as UserIcon } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useVineyards, ShareRole } from '@/providers/VineyardProvider';
import { useAuth } from '@/providers/AuthProvider';

interface RoleChipProps {
  active: boolean;
  label: string;
  description: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
}

function RoleChip({ active, label, description, Icon, onPress }: RoleChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.roleChip, active && styles.roleChipActive, pressed && { opacity: 0.8 }]}
    >
      <Icon size={16} color={active ? Colors.primary : Colors.textSecondary} />
      <Text style={[styles.roleChipLabel, active && styles.roleChipLabelActive]}>{label}</Text>
      <Text style={styles.roleChipDesc}>{description}</Text>
    </Pressable>
  );
}

export default function ShareVineyardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { vineyards, shares, shareVineyard, updateShare, removeShare, isSharing } = useVineyards();
  const [email, setEmail] = useState<string>('');
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [role, setRole] = useState<ShareRole>('worker');

  const vineyard = vineyards.find((v) => v.id === id);
  const vineyardShares = shares.filter((s) => s.vineyard_id === id);
  const isOwner = vineyard?.owner_id === user?.id;

  if (!vineyard) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Share Vineyard' }} />
        <Text style={styles.errorText}>Vineyard not found</Text>
      </View>
    );
  }

  const handleShare = async () => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Enter the email address of the person to share with.');
      return;
    }
    if (email.trim() === user?.email) {
      Alert.alert('Invalid', "You can't share with yourself.");
      return;
    }
    try {
      await shareVineyard(vineyard.id, email.trim(), permission, role);
      Alert.alert('Shared', `Vineyard shared with ${email.trim()}`);
      setEmail('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to share';
      Alert.alert('Error', msg);
    }
  };

  const handleRemoveShare = (shareId: string, shareEmail: string) => {
    Alert.alert('Remove Access', `Remove ${shareEmail}'s access?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void removeShare(shareId),
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: `Share ${vineyard.name}` }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerCard}>
          <Share2 size={20} color={Colors.primary} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{vineyard.name}</Text>
            <Text style={styles.headerSubtitle}>
              {vineyard.variety} · {vineyard.area.toFixed(1)} {vineyard.area_unit}
            </Text>
          </View>
        </View>

        {isOwner && (
          <>
            <Text style={styles.sectionHeader}>INVITE COLLABORATOR</Text>
            <View style={styles.formCard}>
              <View style={styles.inputRow}>
                <View style={styles.inputIcon}>
                  <Mail size={16} color={Colors.textMuted} />
                </View>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.roleSection}>
                <Text style={styles.permissionLabel}>Role</Text>
                <View style={styles.roleRow}>
                  <RoleChip
                    active={role === 'manager'}
                    label="Manager"
                    description="Manage vineyard & team"
                    Icon={Shield}
                    onPress={() => { setRole('manager'); setPermission('edit'); }}
                  />
                  <RoleChip
                    active={role === 'worker'}
                    label="Worker"
                    description="Log tasks & observations"
                    Icon={HardHat}
                    onPress={() => { setRole('worker'); setPermission('edit'); }}
                  />
                  <RoleChip
                    active={role === 'owner'}
                    label="Viewer"
                    description="Read-only access"
                    Icon={UserIcon}
                    onPress={() => { setRole('owner'); setPermission('view'); }}
                  />
                </View>
              </View>
              <View style={styles.permissionRow}>
                <Text style={styles.permissionLabel}>Permission:</Text>
                <View style={styles.permissionBtns}>
                  <Pressable
                    style={[styles.permBtn, permission === 'view' && styles.permBtnActive]}
                    onPress={() => setPermission('view')}
                  >
                    <Text style={[styles.permBtnText, permission === 'view' && styles.permBtnTextActive]}>
                      View Only
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.permBtn, permission === 'edit' && styles.permBtnActive]}
                    onPress={() => setPermission('edit')}
                  >
                    <Text style={[styles.permBtnText, permission === 'edit' && styles.permBtnTextActive]}>
                      Can Edit
                    </Text>
                  </Pressable>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.shareBtn,
                  isSharing && styles.shareBtnDisabled,
                  pressed && !isSharing && styles.shareBtnPressed,
                ]}
                onPress={() => void handleShare()}
                disabled={isSharing}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color={Colors.background} />
                ) : (
                  <Text style={styles.shareBtnText}>Share Vineyard</Text>
                )}
              </Pressable>
            </View>
          </>
        )}

        <Text style={styles.sectionHeader}>
          COLLABORATORS ({vineyardShares.length})
        </Text>
        {vineyardShares.length === 0 ? (
          <View style={styles.emptyCard}>
            <Users size={24} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No collaborators yet</Text>
            <Text style={styles.emptySubtext}>
              Share this vineyard with team members to collaborate
            </Text>
          </View>
        ) : (
          <View style={styles.sharesList}>
            {vineyardShares.map((share) => (
              <View key={share.id} style={styles.shareItem}>
                <View style={styles.shareInfo}>
                  <Text style={styles.shareEmail}>{share.shared_with_email}</Text>
                  <View style={styles.shareMetaRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        share.status === 'accepted' && styles.statusAccepted,
                        share.status === 'pending' && styles.statusPending,
                        share.status === 'declined' && styles.statusDeclined,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          share.status === 'accepted' && styles.statusTextAccepted,
                          share.status === 'pending' && styles.statusTextPending,
                          share.status === 'declined' && styles.statusTextDeclined,
                        ]}
                      >
                        {share.status}
                      </Text>
                    </View>
                    <Text style={styles.permText}>{share.permission}</Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{share.role ?? 'worker'}</Text>
                    </View>
                  </View>
                  {isOwner && (
                    <View style={styles.inlineRoleRow}>
                      {(['manager', 'worker', 'owner'] as ShareRole[]).map((r) => (
                        <Pressable
                          key={r}
                          style={[styles.miniRoleBtn, (share.role ?? 'worker') === r && styles.miniRoleBtnActive]}
                          onPress={() => void updateShare(share.id, { role: r, permission: r === 'owner' ? 'view' : 'edit' })}
                        >
                          <Text style={[styles.miniRoleText, (share.role ?? 'worker') === r && styles.miniRoleTextActive]}>
                            {r === 'owner' ? 'viewer' : r}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
                {isOwner && (
                  <Pressable
                    style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                    onPress={() => handleRemoveShare(share.id, share.shared_with_email)}
                    hitSlop={8}
                  >
                    <Trash2 size={14} color={Colors.danger} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center' as const,
    marginTop: 60,
  },
  headerCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  headerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 20,
    marginLeft: 4,
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 14,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  permissionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  permissionLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  permissionBtns: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  permBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  permBtnActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  permBtnText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  permBtnTextActive: {
    color: Colors.primary,
  },
  shareBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  shareBtnDisabled: {
    opacity: 0.6,
  },
  shareBtnPressed: {
    opacity: 0.85,
  },
  shareBtnText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center' as const,
    gap: 8,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center' as const,
  },
  sharesList: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  shareItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  shareInfo: {
    flex: 1,
  },
  shareEmail: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  shareMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusAccepted: {
    backgroundColor: Colors.primaryMuted,
  },
  statusPending: {
    backgroundColor: Colors.warningMuted,
  },
  statusDeclined: {
    backgroundColor: Colors.dangerMuted,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
  },
  statusTextAccepted: {
    color: Colors.primary,
  },
  statusTextPending: {
    color: Colors.warning,
  },
  statusTextDeclined: {
    color: Colors.danger,
  },
  permText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dangerMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pressed: {
    opacity: 0.7,
  },
  bottomSpacer: {
    height: 40,
  },
  roleSection: {
    gap: 8,
  },
  roleRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  roleChip: {
    flex: 1,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 10,
    gap: 4,
  },
  roleChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  roleChipLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  roleChipLabelActive: {
    color: Colors.primary,
  },
  roleChipDesc: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '500' as const,
  },
  roleBadge: {
    backgroundColor: Colors.secondaryMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  roleBadgeText: {
    color: Colors.secondary,
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'capitalize' as const,
  },
  inlineRoleRow: {
    flexDirection: 'row' as const,
    gap: 6,
    marginTop: 6,
  },
  miniRoleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  miniRoleBtnActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  miniRoleText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
  },
  miniRoleTextActive: {
    color: Colors.primary,
  },
});
