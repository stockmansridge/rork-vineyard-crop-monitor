import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { AlertTriangle, AlertCircle, Info, BellOff, Settings as SettingsIcon, CheckCheck } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAlerts, ComputedAlert } from '@/providers/AlertsProvider';
import DataTrustBadge from '@/components/DataTrustBadge';
import { evaluateTrust } from '@/lib/dataTrust';
import type { DataKind } from '@/lib/dataTrust';

function severityConfig(sev: ComputedAlert['severity']) {
  switch (sev) {
    case 'danger':
      return { color: Colors.danger, bg: Colors.dangerMuted, Icon: AlertCircle };
    case 'warning':
      return { color: Colors.warning, bg: Colors.warningMuted, Icon: AlertTriangle };
    default:
      return { color: Colors.info, bg: Colors.infoMuted, Icon: Info };
  }
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function AlertsScreen() {
  const router = useRouter();
  const { alerts, readIds, markRead, markAllRead, unreadCount } = useAlerts();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Alerts',
          headerRight: () => (
            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <Pressable
                  onPress={() => void markAllRead()}
                  style={({ pressed }) => [pressed && styles.pressed]}
                  hitSlop={8}
                >
                  <CheckCheck size={20} color={Colors.primary} />
                </Pressable>
              )}
              <Pressable
                onPress={() => router.push('/notification-settings')}
                style={({ pressed }) => [pressed && styles.pressed]}
                hitSlop={8}
              >
                <SettingsIcon size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {alerts.length === 0 ? (
          <View style={styles.empty}>
            <BellOff size={32} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No active alerts</Text>
            <Text style={styles.emptyText}>You&apos;re all caught up. Threshold-based alerts will appear here.</Text>
            <Pressable
              onPress={() => router.push('/notification-settings')}
              style={({ pressed }) => [styles.emptyBtn, pressed && styles.pressed]}
            >
              <Text style={styles.emptyBtnText}>Configure Alerts</Text>
            </Pressable>
          </View>
        ) : (
          alerts.map((a) => {
            const cfg = severityConfig(a.severity);
            const isRead = readIds.has(a.id);
            return (
              <Pressable
                key={a.id}
                onPress={() => {
                  void markRead(a.id);
                  if (a.vineyardId) {
                    router.push({ pathname: '/field-detail', params: { id: a.vineyardId } });
                  }
                }}
                style={({ pressed }) => [styles.card, !isRead && styles.unread, pressed && styles.pressed]}
              >
                <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
                  <cfg.Icon size={18} color={cfg.color} />
                </View>
                <View style={styles.body}>
                  <View style={styles.header}>
                    <Text style={styles.title} numberOfLines={1}>{a.title}</Text>
                    {!isRead && <View style={[styles.dot, { backgroundColor: cfg.color }]} />}
                  </View>
                  <Text style={styles.message} numberOfLines={3}>{a.message}</Text>
                  <View style={styles.footer}>
                    <Text style={styles.vineyard}>{a.vineyardName}</Text>
                    <Text style={styles.time}>{timeAgo(a.timestamp)}</Text>
                  </View>
                  <View style={styles.trustRow}>
                    <DataTrustBadge
                      trust={evaluateTrust({
                        sourceType: a.category === 'frost' || a.category === 'heat' || a.category === 'rain' || a.category === 'disease'
                          ? 'derived'
                          : 'observed',
                        sourceName: a.category === 'frost' || a.category === 'heat' || a.category === 'rain' || a.category === 'disease'
                          ? 'Open-Meteo forecast model'
                          : `Probe reading · ${a.vineyardName}`,
                        observedAt: a.timestamp,
                        scopeType: a.category === 'frost' || a.category === 'heat' || a.category === 'rain' || a.category === 'disease'
                          ? 'vineyard'
                          : 'probe',
                        methodVersion: 'alerts-v1',
                        kind: (a.category === 'frost' || a.category === 'heat' || a.category === 'rain'
                          ? 'weather-forecast'
                          : a.category === 'disease'
                          ? 'disease'
                          : 'probe') as DataKind,
                        note: a.category === 'disease'
                          ? 'Disease risk is modelled from forecast inputs. Treat as advisory.'
                          : undefined,
                      })}
                      compact
                    />
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 10 },
  headerActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16 },
  pressed: { opacity: 0.7 },
  card: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 12,
  },
  unread: { backgroundColor: Colors.cardHover, borderColor: Colors.cardHover },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  body: { flex: 1 },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  title: { color: Colors.text, fontSize: 14, fontWeight: '600' as const, flex: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  message: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3 },
  footer: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: 6 },
  vineyard: { color: Colors.textMuted, fontSize: 11, fontWeight: '500' as const },
  time: { color: Colors.textMuted, fontSize: 11 },
  trustRow: { flexDirection: 'row' as const, marginTop: 8 },
  empty: {
    alignItems: 'center' as const,
    padding: 40,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 10,
    marginTop: 40,
  },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' as const },
  emptyText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' as const },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '700' as const },
});
