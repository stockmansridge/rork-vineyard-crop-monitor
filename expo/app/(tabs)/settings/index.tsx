import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  Alert,
  Keyboard,
} from 'react-native';
import {
  Satellite,
  Database,
  Bell,
  MapPin,
  Shield,
  CircleHelp,
  ChevronRight,
  ExternalLink,
  Grape,
  Plus,
  Trash2,
  Check,
  X,
  RotateCcw,
  CloudSun,
  FileText,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useWeatherStation } from '@/providers/WeatherStationProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { LogOut } from 'lucide-react-native';

const CUSTOM_VARIETIES_KEY = 'custom_grape_varieties';
const DELETED_DEFAULTS_KEY = 'deleted_default_varieties';

const DEFAULT_VARIETIES = [
  'Pinot Noir',
  'Chardonnay',
  'Shiraz',
  'Cabernet Sauvignon',
  'Merlot',
  'Sauvignon Blanc',
  'Riesling',
  'Tempranillo',
  'Grenache',
];

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
}

function SettingItem({ icon, title, subtitle, rightElement, onPress }: SettingItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.settingItem, pressed && onPress ? styles.pressed : null]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingIcon}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement ?? <ChevronRight size={16} color={Colors.textMuted} />}
    </Pressable>
  );
}

interface VarietyItemProps {
  name: string;
  isDefault: boolean;
  onDelete: () => void;
}

function VarietyItem({ name, isDefault, onDelete }: VarietyItemProps) {
  return (
    <View style={styles.varietyItem}>
      <View style={styles.varietyInfo}>
        <View style={[styles.varietyDot, isDefault ? styles.varietyDotDefault : styles.varietyDotCustom]} />
        <Text style={styles.varietyName}>{name}</Text>
        {isDefault && <Text style={styles.varietyBadge}>Default</Text>}
      </View>
      <Pressable
        style={({ pressed }) => [styles.varietyDeleteBtn, pressed && styles.pressed]}
        onPress={onDelete}
        hitSlop={8}
      >
        <Trash2 size={14} color={Colors.danger} />
      </Pressable>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, user, signOut, isSigningOut, isDemoMode } = useAuth();
  const { station } = useWeatherStation();
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const [customVarieties, setCustomVarieties] = useState<string[]>([]);
  const [deletedDefaults, setDeletedDefaults] = useState<string[]>([]);
  const [showAddInput, setShowAddInput] = useState<boolean>(false);
  const [newVarietyInput, setNewVarietyInput] = useState<string>('');
  const [showVarieties, setShowVarieties] = useState<boolean>(false);

  useEffect(() => {
    void loadVarietyData();
  }, []);

  const loadVarietyData = async () => {
    try {
      const [customStored, deletedStored] = await Promise.all([
        AsyncStorage.getItem(CUSTOM_VARIETIES_KEY),
        AsyncStorage.getItem(DELETED_DEFAULTS_KEY),
      ]);
      if (customStored) {
        setCustomVarieties(JSON.parse(customStored) as string[]);
      }
      if (deletedStored) {
        setDeletedDefaults(JSON.parse(deletedStored) as string[]);
      }
      console.log('Loaded variety data');
    } catch (e) {
      console.log('Error loading variety data:', e);
    }
  };

  const activeDefaults = DEFAULT_VARIETIES.filter((v) => !deletedDefaults.includes(v));

  const handleAddVariety = useCallback(async () => {
    const trimmed = newVarietyInput.trim();
    if (!trimmed) return;

    const allCurrent = [...activeDefaults, ...customVarieties];
    if (allCurrent.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Already Exists', `"${trimmed}" is already in your variety list.`);
      return;
    }

    if (deletedDefaults.includes(trimmed)) {
      const updatedDeleted = deletedDefaults.filter((d) => d !== trimmed);
      setDeletedDefaults(updatedDeleted);
      await AsyncStorage.setItem(DELETED_DEFAULTS_KEY, JSON.stringify(updatedDeleted));
      console.log('Restored default variety:', trimmed);
    } else {
      const updated = [...customVarieties, trimmed];
      setCustomVarieties(updated);
      await AsyncStorage.setItem(CUSTOM_VARIETIES_KEY, JSON.stringify(updated));
      console.log('Added custom variety:', trimmed);
    }

    setNewVarietyInput('');
    setShowAddInput(false);
    Keyboard.dismiss();
  }, [newVarietyInput, activeDefaults, customVarieties, deletedDefaults]);

  const handleDeleteCustom = useCallback(
    async (name: string) => {
      Alert.alert('Remove Variety', `Remove "${name}" from your list?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = customVarieties.filter((v) => v !== name);
            setCustomVarieties(updated);
            await AsyncStorage.setItem(CUSTOM_VARIETIES_KEY, JSON.stringify(updated));
            console.log('Deleted custom variety:', name);
          },
        },
      ]);
    },
    [customVarieties]
  );

  const handleDeleteDefault = useCallback(
    async (name: string) => {
      Alert.alert('Hide Default Variety', `Hide "${name}" from the default list? You can restore it later.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide',
          style: 'destructive',
          onPress: async () => {
            const updated = [...deletedDefaults, name];
            setDeletedDefaults(updated);
            await AsyncStorage.setItem(DELETED_DEFAULTS_KEY, JSON.stringify(updated));
            console.log('Hid default variety:', name);
          },
        },
      ]);
    },
    [deletedDefaults]
  );

  const handleRestoreDefaults = useCallback(async () => {
    Alert.alert('Restore Defaults', 'Restore all default grape varieties?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          setDeletedDefaults([]);
          await AsyncStorage.setItem(DELETED_DEFAULTS_KEY, JSON.stringify([]));
          console.log('Restored all default varieties');
        },
      },
    ]);
  }, []);

  const totalVarieties = activeDefaults.length + customVarieties.length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.sectionHeader}>ACCOUNT</Text>
      <View style={styles.section}>
        <View style={styles.accountCard}>
          <View style={[styles.avatarCircle, isDemoMode && styles.avatarCircleDemo]}>
            <Text style={[styles.avatarText, isDemoMode && styles.avatarTextDemo]}>
              {(profile?.display_name ?? user?.email ?? '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.accountInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.accountName}>{profile?.display_name ?? 'User'}</Text>
              {isDemoMode && (
                <View style={styles.demoBadge}>
                  <Text style={styles.demoBadgeText}>DEMO</Text>
                </View>
              )}
            </View>
            <Text style={styles.accountEmail}>{user?.email ?? ''}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <SettingItem
          icon={<LogOut size={18} color={Colors.danger} />}
          title={isDemoMode ? 'Exit Demo' : 'Sign Out'}
          subtitle={isSigningOut ? 'Signing out...' : isDemoMode ? 'Return to login screen' : undefined}
          rightElement={null}
          onPress={() => {
            Alert.alert(
              isDemoMode ? 'Exit Demo' : 'Sign Out',
              isDemoMode
                ? 'Exit demo mode? Create an account to save your data.'
                : 'Are you sure you want to sign out?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: isDemoMode ? 'Exit Demo' : 'Sign Out',
                  style: 'destructive',
                  onPress: () => void signOut(),
                },
              ]
            );
          }}
        />
      </View>

      <Text style={styles.sectionHeader}>DATA SOURCES</Text>
      <View style={styles.section}>
        <SettingItem
          icon={<CloudSun size={18} color={Colors.info} />}
          title="Weather Station"
          subtitle={station ? station.stationName : 'Select a Weather Underground PWS'}
          onPress={() => router.push('/weather-station')}
        />
        <View style={styles.divider} />
        <SettingItem
          icon={<Satellite size={18} color={Colors.sentinel} />}
          title="Sentinel Hub API"
          subtitle="Configure access token and instance"
          onPress={() => console.log('Sentinel Hub settings')}
        />
        <View style={styles.divider} />
        <SettingItem
          icon={<Database size={18} color={Colors.info} />}
          title="Copernicus STAC API"
          subtitle="Sentinel-2 L2A collection endpoint"
          onPress={() => console.log('Copernicus settings')}
        />
        <View style={styles.divider} />
        <SettingItem
          icon={<MapPin size={18} color={Colors.primary} />}
          title="Soil Probe Integration"
          subtitle="MQTT broker and device configuration"
          onPress={() => console.log('Soil probe settings')}
        />
      </View>

      <Text style={styles.sectionHeader}>GRAPE VARIETIES</Text>
      <View style={styles.section}>
        <SettingItem
          icon={<Grape size={18} color={Colors.secondary} />}
          title="Manage Varieties"
          subtitle={`${totalVarieties} varieties configured`}
          rightElement={
            <ChevronRight
              size={16}
              color={Colors.textMuted}
              style={{ transform: [{ rotate: showVarieties ? '90deg' : '0deg' }] }}
            />
          }
          onPress={() => setShowVarieties(!showVarieties)}
        />
      </View>

      {showVarieties && (
        <View style={styles.varietySection}>
          {activeDefaults.length > 0 && (
            <>
              <View style={styles.varietySubheaderRow}>
                <Text style={styles.varietySubheader}>Default Varieties</Text>
                {deletedDefaults.length > 0 && (
                  <Pressable
                    style={({ pressed }) => [styles.restoreBtn, pressed && styles.pressed]}
                    onPress={() => void handleRestoreDefaults()}
                  >
                    <RotateCcw size={11} color={Colors.info} />
                    <Text style={styles.restoreBtnText}>Restore All</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.varietyList}>
                {activeDefaults.map((v) => (
                  <VarietyItem
                    key={`default-${v}`}
                    name={v}
                    isDefault={true}
                    onDelete={() => void handleDeleteDefault(v)}
                  />
                ))}
              </View>
            </>
          )}

          {activeDefaults.length === 0 && deletedDefaults.length > 0 && (
            <Pressable
              style={({ pressed }) => [styles.restoreAllCard, pressed && styles.pressed]}
              onPress={() => void handleRestoreDefaults()}
            >
              <RotateCcw size={16} color={Colors.info} />
              <Text style={styles.restoreAllText}>Restore Default Varieties</Text>
            </Pressable>
          )}

          {customVarieties.length > 0 && (
            <>
              <Text style={styles.varietySubheader}>Custom Varieties</Text>
              <View style={styles.varietyList}>
                {customVarieties.map((v) => (
                  <VarietyItem
                    key={`custom-${v}`}
                    name={v}
                    isDefault={false}
                    onDelete={() => void handleDeleteCustom(v)}
                  />
                ))}
              </View>
            </>
          )}

          {showAddInput ? (
            <View style={styles.addInputContainer}>
              <TextInput
                style={styles.addInput}
                value={newVarietyInput}
                onChangeText={setNewVarietyInput}
                placeholder="Enter variety name"
                placeholderTextColor={Colors.textMuted}
                autoFocus
                onSubmitEditing={() => void handleAddVariety()}
                returnKeyType="done"
              />
              <Pressable
                style={({ pressed }) => [styles.addInputBtn, styles.addInputBtnSave, pressed && styles.pressed]}
                onPress={() => void handleAddVariety()}
              >
                <Check size={15} color={Colors.background} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.addInputBtn, styles.addInputBtnCancel, pressed && styles.pressed]}
                onPress={() => {
                  setShowAddInput(false);
                  setNewVarietyInput('');
                  Keyboard.dismiss();
                }}
              >
                <X size={15} color={Colors.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.addVarietyBtn, pressed && styles.addVarietyBtnPressed]}
              onPress={() => setShowAddInput(true)}
            >
              <Plus size={15} color={Colors.primary} />
              <Text style={styles.addVarietyBtnText}>Add Custom Variety</Text>
            </Pressable>
          )}
        </View>
      )}

      <Text style={styles.sectionHeader}>DATA & REPORTS</Text>
      <View style={styles.section}>
        <SettingItem
          icon={<FileText size={18} color={Colors.primary} />}
          title="Reports & Export"
          subtitle="Generate PDF/CSV reports by vineyard"
          onPress={() => router.push('/reports')}
        />
      </View>

      <Text style={styles.sectionHeader}>PREFERENCES</Text>
      <View style={styles.section}>
        <SettingItem
          icon={<Bell size={18} color={Colors.warning} />}
          title="Alerts & Notifications"
          subtitle="Frost, disease, probe thresholds"
          onPress={() => router.push('/notification-settings')}
        />
        <View style={styles.divider} />
        <SettingItem
          icon={<Database size={18} color={Colors.secondary} />}
          title="Auto-Sync Data"
          subtitle="Fetch latest satellite passes automatically"
          rightElement={
            <Switch
              value={autoSync}
              onValueChange={setAutoSync}
              trackColor={{ false: Colors.backgroundAlt, true: Colors.primaryMuted }}
              thumbColor={autoSync ? Colors.primary : Colors.textMuted}
            />
          }
        />
      </View>

      <Text style={styles.sectionHeader}>ABOUT</Text>
      <View style={styles.section}>
        <SettingItem
          icon={<Shield size={18} color={Colors.textSecondary} />}
          title="Privacy Policy"
          rightElement={<ExternalLink size={16} color={Colors.textMuted} />}
          onPress={() => console.log('Privacy')}
        />
        <View style={styles.divider} />
        <SettingItem
          icon={<CircleHelp size={18} color={Colors.textSecondary} />}
          title="Help & Support"
          rightElement={<ExternalLink size={16} color={Colors.textMuted} />}
          onPress={() => console.log('Help')}
        />
      </View>

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>VineWatch v1.0.0</Text>
        <Text style={styles.versionSubtext}>Sentinel Hub · Copernicus STAC · Supabase</Text>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
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
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 14,
    gap: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  settingSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginLeft: 60,
  },
  varietySection: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  varietySubheaderRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 6,
    marginTop: 4,
  },
  varietySubheader: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  varietyList: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    marginBottom: 10,
  },
  varietyItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  varietyInfo: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  varietyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  varietyDotDefault: {
    backgroundColor: Colors.primary,
  },
  varietyDotCustom: {
    backgroundColor: Colors.secondary,
  },
  varietyName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  varietyBadge: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600' as const,
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  varietyDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.dangerMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  restoreBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.infoMuted,
  },
  restoreBtnText: {
    color: Colors.info,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  restoreAllCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.infoMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    padding: 14,
    marginBottom: 10,
  },
  restoreAllText: {
    color: Colors.info,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  addInputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 4,
  },
  addInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500' as const,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addInputBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  addInputBtnSave: {
    backgroundColor: Colors.primary,
  },
  addInputBtnCancel: {
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  addVarietyBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    backgroundColor: Colors.primaryMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
    paddingVertical: 11,
    marginTop: 4,
  },
  addVarietyBtnPressed: {
    opacity: 0.8,
  },
  addVarietyBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  accountCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 14,
    gap: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: Colors.primary + '40',
  },
  avatarText: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '800' as const,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  accountEmail: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  nameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  demoBadge: {
    backgroundColor: Colors.warningMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  demoBadgeText: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  avatarCircleDemo: {
    backgroundColor: Colors.warningMuted,
    borderColor: Colors.warning + '40',
  },
  avatarTextDemo: {
    color: Colors.warning,
  },
  versionContainer: {
    alignItems: 'center' as const,
    marginTop: 32,
  },
  versionText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  versionSubtext: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  bottomSpacer: {
    height: 20,
  },
});
