import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Droplets, Thermometer, AlertTriangle, FlaskConical, Zap } from 'lucide-react-native';
import Colors from '@/constants/colors';
import SeriesChart, { SeriesPoint } from '@/components/SeriesChart';
import { useProbeReadings } from '@/providers/ProbeReadingsProvider';
import { useAuth } from '@/providers/AuthProvider';

export interface ProbeThresholds {
  moistureMin?: number | null;
  moistureMax?: number | null;
  tempMin?: number | null;
  tempMax?: number | null;
  phMin?: number | null;
  phMax?: number | null;
  ecMin?: number | null;
  ecMax?: number | null;
}

export interface ProbeCurrent {
  moisture?: number;
  temperature?: number;
  ph?: number;
  ec?: number;
}

interface Props {
  probeId: string;
  isOnline: boolean;
  current: ProbeCurrent;
  thresholds?: ProbeThresholds;
}

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function synthesizeHistory(
  probeId: string,
  current: ProbeCurrent,
  days: number = 14
): Array<{
  t: number;
  moisture: number;
  temperature: number;
  ph: number;
  ec: number;
}> {
  const seed = Array.from(probeId).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rnd = seededRand(seed);
  const pts: Array<{
    t: number;
    moisture: number;
    temperature: number;
    ph: number;
    ec: number;
  }> = [];
  const now = Date.now();
  const baseM = current.moisture ?? 25;
  const baseT = current.temperature ?? 16;
  const baseP = current.ph ?? 6.4;
  const baseE = current.ec ?? 1.2;
  let m = baseM;
  let t = baseT;
  let ph = baseP;
  let ec = baseE;
  for (let i = days * 4 - 1; i >= 0; i--) {
    const ts = now - i * 6 * 3600 * 1000;
    m += (rnd() - 0.5) * 2 + (baseM - m) * 0.08;
    t += (rnd() - 0.5) * 1.2 + (baseT - t) * 0.1;
    ph += (rnd() - 0.5) * 0.05 + (baseP - ph) * 0.12;
    ec += (rnd() - 0.5) * 0.08 + (baseE - ec) * 0.1;
    pts.push({
      t: ts,
      moisture: Math.max(0, Math.min(60, m)),
      temperature: Math.max(-5, Math.min(45, t)),
      ph: Math.max(4, Math.min(9, ph)),
      ec: Math.max(0.1, Math.min(4, ec)),
    });
  }
  return pts;
}

interface Alert {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  message: string;
}

function checkAlerts(current: ProbeCurrent, t?: ProbeThresholds): Alert[] {
  const alerts: Alert[] = [];
  if (!t) return alerts;
  if (current.moisture != null) {
    if (t.moistureMin != null && current.moisture < t.moistureMin) {
      alerts.push({
        icon: Droplets,
        color: Colors.danger,
        message: `Moisture ${current.moisture.toFixed(1)}% below minimum ${t.moistureMin}%`,
      });
    }
    if (t.moistureMax != null && current.moisture > t.moistureMax) {
      alerts.push({
        icon: Droplets,
        color: Colors.warning,
        message: `Moisture ${current.moisture.toFixed(1)}% above maximum ${t.moistureMax}%`,
      });
    }
  }
  if (current.temperature != null) {
    if (t.tempMin != null && current.temperature < t.tempMin) {
      alerts.push({
        icon: Thermometer,
        color: Colors.info,
        message: `Temperature ${current.temperature.toFixed(1)}°C below ${t.tempMin}°C`,
      });
    }
    if (t.tempMax != null && current.temperature > t.tempMax) {
      alerts.push({
        icon: Thermometer,
        color: Colors.danger,
        message: `Temperature ${current.temperature.toFixed(1)}°C above ${t.tempMax}°C`,
      });
    }
  }
  if (current.ph != null) {
    if (t.phMin != null && current.ph < t.phMin) {
      alerts.push({
        icon: FlaskConical,
        color: Colors.warning,
        message: `pH ${current.ph.toFixed(2)} below ${t.phMin}`,
      });
    }
    if (t.phMax != null && current.ph > t.phMax) {
      alerts.push({
        icon: FlaskConical,
        color: Colors.warning,
        message: `pH ${current.ph.toFixed(2)} above ${t.phMax}`,
      });
    }
  }
  if (current.ec != null) {
    if (t.ecMin != null && current.ec < t.ecMin) {
      alerts.push({
        icon: Zap,
        color: Colors.info,
        message: `EC ${current.ec.toFixed(2)} below ${t.ecMin}`,
      });
    }
    if (t.ecMax != null && current.ec > t.ecMax) {
      alerts.push({
        icon: Zap,
        color: Colors.danger,
        message: `EC ${current.ec.toFixed(2)} above ${t.ecMax}`,
      });
    }
  }
  return alerts;
}

export default function ProbeChartsSection({ probeId, current, thresholds }: Props) {
  const { isDemoMode } = useAuth();
  const { getProbeReadings, isLoading } = useProbeReadings();

  const history = useMemo(() => {
    if (!isDemoMode) {
      const stored = getProbeReadings(probeId, 14);
      if (stored.length >= 2) {
        return stored.map((r) => ({
          t: new Date(r.recorded_at).getTime(),
          moisture: Number(r.moisture ?? current.moisture ?? 0),
          temperature: Number(r.temperature ?? current.temperature ?? 0),
          ph: Number(r.ph ?? current.ph ?? 0),
          ec: Number(r.ec ?? current.ec ?? 0),
        }));
      }
    }
    return synthesizeHistory(probeId, current, 14);
  }, [probeId, current, isDemoMode, getProbeReadings]);

  const moisturePts = useMemo<SeriesPoint[]>(
    () => history.map((p) => ({ x: p.t, y: p.moisture })),
    [history]
  );
  const tempPts = useMemo<SeriesPoint[]>(
    () => history.map((p) => ({ x: p.t, y: p.temperature })),
    [history]
  );

  const alerts = useMemo(
    () => checkAlerts(current, thresholds),
    [current, thresholds]
  );

  return (
    <>
      {alerts.length > 0 && (
        <View style={styles.alertsCard}>
          <View style={styles.alertsHeader}>
            <AlertTriangle size={14} color={Colors.warning} />
            <Text style={styles.alertsTitle}>
              {alerts.length} active alert{alerts.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {alerts.map((a, i) => {
            const Icon = a.icon;
            return (
              <View key={i} style={styles.alertRow}>
                <Icon size={12} color={a.color} />
                <Text style={[styles.alertText, { color: a.color }]}>{a.message}</Text>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionLabel}>SOIL MOISTURE (14D)</Text>
      <View style={styles.chartCard}>
        {isLoading && history.length === 0 ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <>
            <View style={styles.chartHeader}>
              <Droplets size={14} color={Colors.info} />
              <Text style={styles.chartValue}>{(current.moisture ?? 0).toFixed(1)}%</Text>
              <Text style={styles.chartRange}>
                {thresholds?.moistureMin ?? '—'}–{thresholds?.moistureMax ?? '—'}%
              </Text>
            </View>
            <SeriesChart
              points={moisturePts}
              color={Colors.info}
              height={120}
              width={300}
              thresholdMin={thresholds?.moistureMin ?? null}
              thresholdMax={thresholds?.moistureMax ?? null}
              formatY={(v) => `${v.toFixed(0)}`}
            />
          </>
        )}
      </View>

      <Text style={styles.sectionLabel}>SOIL TEMPERATURE (14D)</Text>
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Thermometer size={14} color={Colors.warning} />
          <Text style={styles.chartValue}>{(current.temperature ?? 0).toFixed(1)}°C</Text>
          <Text style={styles.chartRange}>
            {thresholds?.tempMin ?? '—'}–{thresholds?.tempMax ?? '—'}°C
          </Text>
        </View>
        <SeriesChart
          points={tempPts}
          color={Colors.warning}
          height={120}
          width={300}
          thresholdMin={thresholds?.tempMin ?? null}
          thresholdMax={thresholds?.tempMax ?? null}
          formatY={(v) => `${v.toFixed(0)}°`}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 4,
  },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  chartValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  chartRange: {
    marginLeft: 'auto' as const,
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  alertsCard: {
    backgroundColor: Colors.warningMuted,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
    marginTop: 12,
    gap: 6,
  },
  alertsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  alertsTitle: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertText: {
    fontSize: 12,
    fontWeight: '600' as const,
    flex: 1,
  },
});
