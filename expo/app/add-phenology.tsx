import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert, Pressable, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useRecords, PhenologyStage } from '@/providers/RecordsProvider';
import { useWeather } from '@/hooks/useWeather';
import { useVineyards } from '@/providers/VineyardProvider';
import { useVineyardPermissions } from '@/hooks/usePermissions';
import {
  FormSection,
  FormField,
  ChipRow,
  DateField,
  SaveButton,
} from '@/components/RecordFormFields';

const STAGES: { value: PhenologyStage; label: string }[] = [
  { value: 'dormant', label: 'Dormant' },
  { value: 'budbreak', label: 'Budbreak' },
  { value: 'leaf_out', label: 'Leaf Out' },
  { value: 'flowering', label: 'Flowering' },
  { value: 'fruit_set', label: 'Fruit Set' },
  { value: 'veraison', label: 'Véraison' },
  { value: 'ripening', label: 'Ripening' },
  { value: 'harvest', label: 'Harvest' },
  { value: 'post_harvest', label: 'Post-Harvest' },
  { value: 'leaf_fall', label: 'Leaf Fall' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AddPhenologyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addPhenology, isAddingPhenology } = useRecords();
  const { vineyards } = useVineyards();
  const vineyard = vineyards.find((v) => v.id === id);
  const weather = useWeather(vineyard?.latitude ?? null, vineyard?.longitude ?? null);
  const perms = useVineyardPermissions(id ?? null);

  const [stage, setStage] = useState<PhenologyStage>('budbreak');
  const [observedOn, setObservedOn] = useState<string>(todayISO());
  const [percent, setPercent] = useState<string>('50');
  const [notes, setNotes] = useState<string>('');

  const handleSave = async () => {
    if (!id) return;
    if (!perms.canCreateRecord) {
      Alert.alert('Read-only access', 'Your role does not allow creating records.');
      return;
    }
    try {
      await addPhenology({
        vineyard_id: id,
        stage,
        observed_on: observedOn,
        percent_complete: percent ? parseInt(percent, 10) : null,
        gdd_at_event: weather.data?.cumulativeGdd ?? null,
        notes: notes.trim() || null,
        photo_url: null,
      });
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      Alert.alert('Error', msg);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Log Phenology',
          headerRight: () => (
            <Pressable onPress={() => void handleSave()} disabled={isAddingPhenology}>
              <Text style={[styles.save, isAddingPhenology && styles.disabled]}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FormSection label="STAGE">
          <ChipRow label="Phenological stage" options={STAGES} value={stage} onChange={setStage} />
        </FormSection>

        <FormSection label="OBSERVATION">
          <DateField label="Observed on" value={observedOn} onChangeText={setObservedOn} />
          <FormField
            label="% of vines at this stage"
            value={percent}
            onChangeText={setPercent}
            keyboardType="numeric"
            placeholder="0-100"
          />
          <FormField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="First cluster observed, weather conditions…"
            multiline
          />
          {weather.data && (
            <Text style={styles.hint}>
              Auto-captured GDD: {Math.round(weather.data.cumulativeGdd)} (base 10°C)
            </Text>
          )}
        </FormSection>

        <SaveButton
          label="Save phenology event"
          onPress={() => void handleSave()}
          disabled={isAddingPhenology}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  save: { color: Colors.primary, fontSize: 15, fontWeight: '700' as const },
  disabled: { opacity: 0.5 },
  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic' as const,
  },
});
