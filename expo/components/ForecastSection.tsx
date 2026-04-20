import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { CloudSun, AlertTriangle, Wind, Droplet, Thermometer } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useForecast } from '@/hooks/useForecast';
import { weatherCodeToDescription } from '@/lib/weather';

interface Props {
  latitude: number | null;
  longitude: number | null;
}

export default function ForecastSection({ latitude, longitude }: Props) {
  const { data, isLoading, error } = useForecast(latitude, longitude);

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <CloudSun size={16} color={Colors.info} />
        <Text style={styles.title}>7-Day Forecast</Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading forecast…</Text>
        </View>
      ) : error ? (
        <Text style={styles.errorText}>Unable to load forecast</Text>
      ) : data ? (
        <>
          {data.frostRisk && data.nextFrostDate && (
            <View style={styles.frostBanner}>
              <AlertTriangle size={14} color={Colors.warning} />
              <Text style={styles.frostText}>
                Frost risk:{' '}
                {new Date(data.nextFrostDate).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
          )}

          {data.current && (
            <View style={styles.currentRow}>
              <Text style={styles.currentEmoji}>
                {weatherCodeToDescription(data.current.weatherCode).emoji}
              </Text>
              <View style={styles.currentMid}>
                <Text style={styles.currentTemp}>
                  {Math.round(data.current.temperature)}°
                </Text>
                <Text style={styles.currentLabel}>
                  {weatherCodeToDescription(data.current.weatherCode).label}
                </Text>
              </View>
              <View style={styles.currentMetrics}>
                <View style={styles.metricChip}>
                  <Droplet size={11} color={Colors.info} />
                  <Text style={styles.metricText}>{Math.round(data.current.humidity)}%</Text>
                </View>
                <View style={styles.metricChip}>
                  <Wind size={11} color={Colors.textSecondary} />
                  <Text style={styles.metricText}>
                    {Math.round(data.current.windSpeed)} km/h
                  </Text>
                </View>
              </View>
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysRow}>
            {data.days.map((d) => {
              const wc = weatherCodeToDescription(d.weatherCode);
              const frost = d.tMin <= 2;
              return (
                <View key={d.date} style={[styles.dayCard, frost && styles.dayCardFrost]}>
                  <Text style={styles.dayName}>
                    {new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}
                  </Text>
                  <Text style={styles.dayEmoji}>{wc.emoji}</Text>
                  <Text style={styles.dayHigh}>{Math.round(d.tMax)}°</Text>
                  <Text style={[styles.dayLow, frost && styles.dayLowFrost]}>
                    {Math.round(d.tMin)}°
                  </Text>
                  {d.precipProbability > 20 && (
                    <View style={styles.precipChip}>
                      <Droplet size={9} color={Colors.info} />
                      <Text style={styles.precipText}>{Math.round(d.precipProbability)}%</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    margin: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
  },
  frostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.warningMuted,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
    marginBottom: 12,
  },
  frostText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  currentEmoji: {
    fontSize: 36,
  },
  currentMid: {
    flex: 1,
  },
  currentTemp: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
  },
  currentLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  currentMetrics: {
    gap: 6,
    alignItems: 'flex-end',
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metricText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  daysRow: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  dayCard: {
    width: 64,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  dayCardFrost: {
    borderColor: Colors.warning + '60',
    backgroundColor: Colors.warningMuted + '80',
  },
  dayName: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  dayEmoji: {
    fontSize: 22,
  },
  dayHigh: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  dayLow: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  dayLowFrost: {
    color: Colors.warning,
    fontWeight: '700' as const,
  },
  precipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.infoMuted,
  },
  precipText: {
    color: Colors.info,
    fontSize: 9,
    fontWeight: '700' as const,
  },
});
