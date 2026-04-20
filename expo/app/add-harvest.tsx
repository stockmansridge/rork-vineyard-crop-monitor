import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert, Pressable, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useRecords } from '@/providers/RecordsProvider';
import { useVineyards } from '@/providers/VineyardProvider';
import {
  FormSection,
  FormField,
  DateField,
  SaveButton,
} from '@/components/RecordFormFields';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AddHarvestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addHarvest, isAddingHarvest } = useRecords();
  const { vineyards } = useVineyards();
  const vineyard = vineyards.find((v) => v.id === id);

  const [harvestedOn, setHarvestedOn] = useState<string>(todayISO());
  const [yieldKg, setYieldKg] = useState<string>('');
  const [brix, setBrix] = useState<string>('');
  const [ph, setPh] = useState<string>('');
  const [ta, setTa] = useState<string>('');
  const [yan, setYan] = useState<string>('');
  const [berryWeight, setBerryWeight] = useState<string>('');
  const [clusterCount, setClusterCount] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [pickers, setPickers] = useState<string>('');
  const [laborHours, setLaborHours] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const handleSave = async () => {
    if (!id) return;
    try {
      const kg = yieldKg ? parseFloat(yieldKg) : null;
      const area = vineyard?.area ?? 0;
      const perHa = kg != null && area > 0 ? kg / 1000 / area : null;
      await addHarvest({
        vineyard_id: id,
        harvested_on: harvestedOn,
        yield_kg: kg,
        yield_tons: kg != null ? kg / 1000 : null,
        yield_per_ha: perHa,
        brix: brix ? parseFloat(brix) : null,
        ph: ph ? parseFloat(ph) : null,
        ta: ta ? parseFloat(ta) : null,
        ya_n: yan ? parseFloat(yan) : null,
        berry_weight_g: berryWeight ? parseFloat(berryWeight) : null,
        cluster_count: clusterCount ? parseInt(clusterCount, 10) : null,
        destination: destination.trim() || null,
        picker_count: pickers ? parseInt(pickers, 10) : null,
        labor_hours: laborHours ? parseFloat(laborHours) : null,
        notes: notes.trim() || null,
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
          title: 'Log Harvest',
          headerRight: () => (
            <Pressable onPress={() => void handleSave()} disabled={isAddingHarvest}>
              <Text style={[styles.save, isAddingHarvest && styles.disabled]}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FormSection label="HARVEST">
          <DateField label="Harvested on" value={harvestedOn} onChangeText={setHarvestedOn} />
          <FormField label="Yield (kg)" value={yieldKg} onChangeText={setYieldKg} keyboardType="decimal-pad" />
          <FormField label="Destination" value={destination} onChangeText={setDestination} placeholder="Winery, market…" />
        </FormSection>

        <FormSection label="MUST CHEMISTRY">
          <FormField label="Brix (°Bx)" value={brix} onChangeText={setBrix} keyboardType="decimal-pad" placeholder="22.5" />
          <FormField label="pH" value={ph} onChangeText={setPh} keyboardType="decimal-pad" placeholder="3.45" />
          <FormField label="TA (g/L)" value={ta} onChangeText={setTa} keyboardType="decimal-pad" placeholder="6.2" />
          <FormField label="YAN (mg/L)" value={yan} onChangeText={setYan} keyboardType="decimal-pad" />
        </FormSection>

        <FormSection label="CLUSTER METRICS (optional)">
          <FormField label="Berry weight (g)" value={berryWeight} onChangeText={setBerryWeight} keyboardType="decimal-pad" />
          <FormField label="Cluster count" value={clusterCount} onChangeText={setClusterCount} keyboardType="numeric" />
        </FormSection>

        <FormSection label="LABOR">
          <FormField label="Pickers" value={pickers} onChangeText={setPickers} keyboardType="numeric" />
          <FormField label="Labor hours" value={laborHours} onChangeText={setLaborHours} keyboardType="decimal-pad" />
          <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />
        </FormSection>

        <SaveButton label="Save harvest" onPress={() => void handleSave()} disabled={isAddingHarvest} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  save: { color: Colors.primary, fontSize: 15, fontWeight: '700' as const },
  disabled: { opacity: 0.5 },
});
