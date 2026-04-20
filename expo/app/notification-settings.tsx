import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TextInput, Pressable, Alert, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { Bell, Snowflake, Flame, CloudRain, Bug, Droplets, Battery, WifiOff, BellOff } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAlerts, AlertPreferences } from '@/providers/AlertsProvider';

interface RowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}

function Row({ icon, title, subtitle, value, onValueChange }: RowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.backgroundAlt, true: Colors.primaryMuted }}
        thumbColor={value ? Colors.primary : Colors.textMuted}
      />
    </View>
  );
}

interface ThresholdProps {
  label: string;
  unit: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}

function ThresholdRow({ label, unit, value, onChange, step = 1 }: ThresholdProps) {
  const [text, setText] = useState<string>(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  return (
    <View style={styles.threshRow}>
      <Text style={styles.threshLabel}>{label}</Text>
      <View style={styles.threshRight}>
        <Pressable
          onPress={() => onChange(value - step)}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <TextInput
          style={styles.threshInput}
          value={text}
          onChangeText={setText}
          onBlur={() => {
            const n = Number(text);
            if (Number.isFinite(n)) onChange(n);
            else setText(String(value));
          }}
          keyboardType="numeric"
        />
        <Text style={styles.threshUnit}>{unit}</Text>
        <Pressable
          onPress={() => onChange(value + step)}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const { prefs, savePrefs, permissionGranted, requestPermission } = useAlerts();
  const [local, setLocal] = useState<AlertPreferences>(prefs);

  useEffect(() => {
    setLocal(prefs);
  }, [prefs]);

  const update = useCallback(
    (patch: Partial<AlertPreferences>) => {
      const next = { ...local, ...patch };
      setLocal(next);
      void savePrefs(next);
    },
    [local, savePrefs]
  );

  const updateThreshold = useCallback(
    (patch: Partial<AlertPreferences['thresholds']>) => {
      const next = { ...local, thresholds: { ...local.thresholds, ...patch } };
      setLocal(next);
      void savePrefs(next);
    },
    [local, savePrefs]
  );

  const handleEnableNotifications = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'Push notifications are not available on web.');
      return;
    }
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert('Permission denied', 'Enable notifications in your device settings to receive alerts.');
    }
  }, [requestPermission]);

  return (
    <>
      <Stack.Screen options={{ title: 'Alert Settings' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.permCard}>
          <View style={styles.permIcon}>
            {permissionGranted ? (
              <Bell size={20} color={Colors.primary} />
            ) : (
              <BellOff size={20} color={Colors.warning} />
            )}
          </View>
          <View style={styles.permContent}>
            <Text style={styles.permTitle}>
              {permissionGranted ? 'Push notifications enabled' : 'Push notifications disabled'}
            </Text>
            <Text style={styles.permSubtitle}>
              {permissionGranted
                ? 'You will receive alerts for threshold breaches and weather warnings.'
                : 'Enable notifications to receive frost, disease, and probe alerts.'}
            </Text>
          </View>
          {!permissionGranted && (
            <Pressable
              onPress={() => void handleEnableNotifications()}
              style={({ pressed }) => [styles.permBtn, pressed && styles.pressed]}
            >
              <Text style={styles.permBtnText}>Enable</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.sectionHeader}>MASTER</Text>
        <View style={styles.section}>
          <Row
            icon={<Bell size={18} color={Colors.primary} />}
            title="Alerts Enabled"
            subtitle="Turn all threshold alerts on or off"
            value={local.enabled}
            onValueChange={(v) => update({ enabled: v })}
          />
        </View>

        <Text style={styles.sectionHeader}>WEATHER</Text>
        <View style={styles.section}>
          <Row
            icon={<Snowflake size={18} color={Colors.info} />}
            title="Frost Warnings"
            value={local.frost}
            onValueChange={(v) => update({ frost: v })}
          />
          <View style={styles.divider} />
          <Row
            icon={<Flame size={18} color={Colors.danger} />}
            title="Heat Stress"
            value={local.heat}
            onValueChange={(v) => update({ heat: v })}
          />
          <View style={styles.divider} />
          <Row
            icon={<CloudRain size={18} color={Colors.info} />}
            title="Heavy Rain"
            value={local.rain}
            onValueChange={(v) => update({ rain: v })}
          />
          <View style={styles.divider} />
          <Row
            icon={<Bug size={18} color={Colors.warning} />}
            title="Disease Risk (Powdery Mildew)"
            subtitle="Warm, wet conditions forecast"
            value={local.disease}
            onValueChange={(v) => update({ disease: v })}
          />
        </View>

        <Text style={styles.sectionHeader}>PROBES</Text>
        <View style={styles.section}>
          <Row
            icon={<Droplets size={18} color={Colors.info} />}
            title="Soil Moisture & pH"
            value={local.moisture}
            onValueChange={(v) => update({ moisture: v })}
          />
          <View style={styles.divider} />
          <Row
            icon={<Battery size={18} color={Colors.warning} />}
            title="Low Battery"
            value={local.battery}
            onValueChange={(v) => update({ battery: v })}
          />
          <View style={styles.divider} />
          <Row
            icon={<WifiOff size={18} color={Colors.danger} />}
            title="Probe Offline"
            value={local.offline}
            onValueChange={(v) => update({ offline: v })}
          />
        </View>

        <Text style={styles.sectionHeader}>THRESHOLDS</Text>
        <View style={styles.section}>
          <ThresholdRow
            label="Frost temperature"
            unit="°C"
            value={local.thresholds.frostTempC}
            onChange={(n) => updateThreshold({ frostTempC: n })}
          />
          <View style={styles.divider} />
          <ThresholdRow
            label="Heat temperature"
            unit="°C"
            value={local.thresholds.heatTempC}
            onChange={(n) => updateThreshold({ heatTempC: n })}
          />
          <View style={styles.divider} />
          <ThresholdRow
            label="Heavy rain"
            unit="mm"
            value={local.thresholds.rainMm}
            onChange={(n) => updateThreshold({ rainMm: n })}
          />
          <View style={styles.divider} />
          <ThresholdRow
            label="Low moisture"
            unit="%"
            value={local.thresholds.lowMoisturePct}
            onChange={(n) => updateThreshold({ lowMoisturePct: n })}
          />
          <View style={styles.divider} />
          <ThresholdRow
            label="High moisture"
            unit="%"
            value={local.thresholds.highMoisturePct}
            onChange={(n) => updateThreshold({ highMoisturePct: n })}
          />
          <View style={styles.divider} />
          <ThresholdRow
            label="Low battery"
            unit="%"
            value={local.thresholds.lowBatteryPct}
            onChange={(n) => updateThreshold({ lowBatteryPct: n })}
            step={5}
          />
          <View style={styles.divider} />
          <ThresholdRow
            label="pH min"
            unit=""
            value={local.thresholds.phMin}
            step={0.1}
            onChange={(n) => updateThreshold({ phMin: Number(n.toFixed(1)) })}
          />
          <View style={styles.divider} />
          <ThresholdRow
            label="pH max"
            unit=""
            value={local.thresholds.phMax}
            step={0.1}
            onChange={(n) => updateThreshold({ phMax: Number(n.toFixed(1)) })}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  pressed: { opacity: 0.7 },
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
    overflow: 'hidden' as const,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 14,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  rowContent: { flex: 1 },
  rowTitle: { color: Colors.text, fontSize: 14, fontWeight: '600' as const },
  rowSubtitle: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginLeft: 60 },
  threshRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    gap: 10,
  },
  threshLabel: { color: Colors.text, fontSize: 14, fontWeight: '500' as const, flex: 1 },
  threshRight: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepBtnText: { color: Colors.text, fontSize: 16, fontWeight: '700' as const },
  threshInput: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 56,
    textAlign: 'center' as const,
  },
  threshUnit: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' as const, minWidth: 22 },
  permCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 14,
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  permIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  permContent: { flex: 1 },
  permTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' as const },
  permSubtitle: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  permBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  permBtnText: { color: Colors.background, fontSize: 13, fontWeight: '700' as const },
});
