import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Alert, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Sprout, Flower, Grape, Wheat, CircleDot } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useVineyards } from '@/providers/VineyardProvider';
import { useBlockSeasons } from '@/providers/BlockSeasonsProvider';
import {
  FormSection,
  FormField,
  DateField,
  SaveButton,
} from '@/components/RecordFormFields';

export default function BlockSeasonsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { vineyards } = useVineyards();
  const { getVineyardSeasons, getSeason, upsertSeason, isSaving } = useBlockSeasons();

  const vineyard = useMemo(() => vineyards.find((v) => v.id === id), [vineyards, id]);
  const allSeasons = id ? getVineyardSeasons(id) : [];
  const currentYear = new Date().getFullYear();
  const [season, setSeason] = useState<number>(currentYear);

  const existing = id ? getSeason(id, season) : null;

  const [budburst, setBudburst] = useState<string>(existing?.budburst_date ?? '');
  const [flowering, setFlowering] = useState<string>(existing?.flowering_date ?? '');
  const [fruitSet, setFruitSet] = useState<string>(existing?.fruit_set_date ?? '');
  const [veraison, setVeraison] = useState<string>(existing?.veraison_date ?? '');
  const [harvest, setHarvest] = useState<string>(existing?.harvest_date ?? '');
  const [targetYield, setTargetYield] = useState<string>(
    existing?.target_yield_t_per_ha != null ? String(existing.target_yield_t_per_ha) : ''
  );
  const [actualYield, setActualYield] = useState<string>(
    existing?.actual_yield_t_per_ha != null ? String(existing.actual_yield_t_per_ha) : ''
  );
  const [notes, setNotes] = useState<string>(existing?.notes ?? '');
  const [loadedSeason, setLoadedSeason] = useState<number>(season);

  if (loadedSeason !== season) {
    const match = id ? getSeason(id, season) : null;
    setBudburst(match?.budburst_date ?? '');
    setFlowering(match?.flowering_date ?? '');
    setFruitSet(match?.fruit_set_date ?? '');
    setVeraison(match?.veraison_date ?? '');
    setHarvest(match?.harvest_date ?? '');
    setTargetYield(match?.target_yield_t_per_ha != null ? String(match.target_yield_t_per_ha) : '');
    setActualYield(match?.actual_yield_t_per_ha != null ? String(match.actual_yield_t_per_ha) : '');
    setNotes(match?.notes ?? '');
    setLoadedSeason(season);
  }

  if (!vineyard) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Seasons' }} />
        <Text style={styles.empty}>Vineyard not found</Text>
      </View>
    );
  }

  const toNum = (v: string): number | null => {
    const t = v.trim();
    if (!t) return null;
    const p = Number(t);
    return isNaN(p) ? null : p;
  };

  const nullOrStr = (v: string): string | null => (v.trim() ? v.trim() : null);

  const handleSave = async () => {
    if (!id) return;
    try {
      await upsertSeason({
        vineyard_id: id,
        season,
        budburst_date: nullOrStr(budburst),
        flowering_date: nullOrStr(flowering),
        fruit_set_date: nullOrStr(fruitSet),
        veraison_date: nullOrStr(veraison),
        harvest_date: nullOrStr(harvest),
        target_yield_t_per_ha: toNum(targetYield),
        actual_yield_t_per_ha: toNum(actualYield),
        notes: nullOrStr(notes),
      });
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      Alert.alert('Error', msg);
    }
  };

  const stages = [
    { key: 'budburst', label: 'Budburst', value: budburst, Icon: Sprout, color: Colors.primary },
    { key: 'flowering', label: 'Flowering', value: flowering, Icon: Flower, color: Colors.secondary },
    { key: 'fruitSet', label: 'Fruit set', value: fruitSet, Icon: CircleDot, color: Colors.info },
    { key: 'veraison', label: 'Veraison', value: veraison, Icon: Grape, color: Colors.msavi },
    { key: 'harvest', label: 'Harvest', value: harvest, Icon: Wheat, color: Colors.warning },
  ];

  const completedCount = stages.filter((s) => !!s.value).length;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Seasons',
          headerRight: () => (
            <Pressable onPress={() => void handleSave()} disabled={isSaving}>
              <Text style={[styles.save, isSaving && styles.disabled]}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerBlock}>
          <Text style={styles.headerVariety}>{vineyard.variety}</Text>
          <Text style={styles.headerName}>{vineyard.name}</Text>
          <Text style={styles.headerSub}>Seasonal phenology & target dates</Text>
        </View>

        <View style={styles.seasonSwitcher}>
          <Pressable
            onPress={() => setSeason((s) => s - 1)}
            style={({ pressed }) => [styles.seasonBtn, pressed && styles.pressed]}
            hitSlop={10}
            testID="season-prev"
          >
            <ChevronLeft size={18} color={Colors.text} />
          </Pressable>
          <View style={styles.seasonCenter}>
            <Text style={styles.seasonLabel}>SEASON</Text>
            <Text style={styles.seasonValue}>{season}</Text>
            <Text style={styles.seasonHint}>
              {completedCount}/5 stages recorded
            </Text>
          </View>
          <Pressable
            onPress={() => setSeason((s) => s + 1)}
            style={({ pressed }) => [styles.seasonBtn, pressed && styles.pressed]}
            hitSlop={10}
            testID="season-next"
          >
            <ChevronRight size={18} color={Colors.text} />
          </Pressable>
        </View>

        <View style={styles.timeline}>
          {stages.map((s, i) => (
            <View key={s.key} style={styles.timelineRow}>
              <View
                style={[
                  styles.timelineDot,
                  { backgroundColor: s.value ? s.color : Colors.cardBorder },
                ]}
              >
                <s.Icon size={12} color={s.value ? Colors.background : Colors.textMuted} />
              </View>
              {i < stages.length - 1 && (
                <View
                  style={[
                    styles.timelineLine,
                    { backgroundColor: s.value ? s.color + '40' : Colors.cardBorder },
                  ]}
                />
              )}
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>{s.label}</Text>
                <Text style={[styles.timelineDate, !s.value && styles.timelineDateEmpty]}>
                  {s.value || 'Not recorded'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <FormSection label="STAGE DATES">
          <DateField label="Budburst" value={budburst} onChangeText={setBudburst} />
          <DateField label="Flowering" value={flowering} onChangeText={setFlowering} />
          <DateField label="Fruit set" value={fruitSet} onChangeText={setFruitSet} />
          <DateField label="Veraison" value={veraison} onChangeText={setVeraison} />
          <DateField label="Harvest" value={harvest} onChangeText={setHarvest} />
        </FormSection>

        <FormSection label="YIELD">
          <FormField
            label="Target yield (t/ha)"
            value={targetYield}
            onChangeText={setTargetYield}
            keyboardType="decimal-pad"
          />
          <FormField
            label="Actual yield (t/ha)"
            value={actualYield}
            onChangeText={setActualYield}
            keyboardType="decimal-pad"
          />
        </FormSection>

        <FormSection label="NOTES">
          <FormField
            label="Season notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Weather, events, anomalies…"
            multiline
          />
        </FormSection>

        {allSeasons.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>HISTORY</Text>
            <View style={styles.historyCard}>
              {allSeasons.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSeason(s.season)}
                  style={({ pressed }) => [
                    styles.historyRow,
                    pressed && styles.pressed,
                    s.season === season && styles.historyRowActive,
                  ]}
                >
                  <Text style={styles.historySeason}>{s.season}</Text>
                  <Text style={styles.historyInfo} numberOfLines={1}>
                    {s.harvest_date
                      ? `Harvest ${s.harvest_date}`
                      : s.budburst_date
                      ? `Budburst ${s.budburst_date}`
                      : 'In progress'}
                  </Text>
                  <ChevronRight size={14} color={Colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        <SaveButton
          label={`Save ${season} season`}
          onPress={() => void handleSave()}
          disabled={isSaving}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 60 },
  save: { color: Colors.primary, fontSize: 15, fontWeight: '700' as const },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  empty: { color: Colors.textSecondary, textAlign: 'center' as const, padding: 40 },
  headerBlock: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerVariety: {
    color: Colors.secondary,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  headerName: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800' as const,
    marginTop: 2,
  },
  headerSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  seasonSwitcher: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginTop: 12,
    padding: 12,
    gap: 12,
  },
  seasonBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  seasonCenter: {
    flex: 1,
    alignItems: 'center' as const,
  },
  seasonLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
  },
  seasonValue: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  seasonHint: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  timeline: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    marginTop: 12,
  },
  timelineRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    position: 'relative' as const,
    paddingBottom: 14,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 1,
  },
  timelineLine: {
    position: 'absolute' as const,
    left: 11,
    top: 24,
    bottom: 0,
    width: 2,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 2,
  },
  timelineLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  timelineDate: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  timelineDateEmpty: {
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  historyCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden' as const,
  },
  historyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  historyRowActive: {
    backgroundColor: Colors.primaryMuted,
  },
  historySeason: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800' as const,
    width: 50,
  },
  historyInfo: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 12,
  },
});
