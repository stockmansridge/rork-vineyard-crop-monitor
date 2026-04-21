import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert, Pressable, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useRecords } from '@/providers/RecordsProvider';
import { useVineyardPermissions } from '@/hooks/usePermissions';
import {
  FormSection,
  FormField,
  DateField,
  SaveButton,
} from '@/components/RecordFormFields';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AddSprayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addSpray, isAddingSpray } = useRecords();
  const perms = useVineyardPermissions(id ?? null);

  const [appliedOn, setAppliedOn] = useState<string>(todayISO());
  const [productName, setProductName] = useState<string>('');
  const [activeIngredient, setActiveIngredient] = useState<string>('');
  const [target, setTarget] = useState<string>('');
  const [rate, setRate] = useState<string>('');
  const [rateUnit, setRateUnit] = useState<string>('L/ha');
  const [waterVolume, setWaterVolume] = useState<string>('');
  const [phiDays, setPhiDays] = useState<string>('');
  const [reiHours, setReiHours] = useState<string>('');
  const [weather, setWeather] = useState<string>('');
  const [wind, setWind] = useState<string>('');
  const [temp, setTemp] = useState<string>('');
  const [applicator, setApplicator] = useState<string>('');
  const [equipment, setEquipment] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const handleSave = async () => {
    if (!id) return;
    if (!perms.canCreateRecord) {
      Alert.alert('Read-only access', 'Your role does not allow creating records.');
      return;
    }
    if (!productName.trim()) {
      Alert.alert('Missing info', 'Please enter the product name.');
      return;
    }
    try {
      await addSpray({
        vineyard_id: id,
        applied_on: new Date(appliedOn).toISOString(),
        product_name: productName.trim(),
        active_ingredient: activeIngredient.trim() || null,
        target: target.trim() || null,
        rate: rate ? parseFloat(rate) : null,
        rate_unit: rateUnit.trim() || null,
        total_volume: null,
        volume_unit: null,
        water_volume: waterVolume ? parseFloat(waterVolume) : null,
        phi_days: phiDays ? parseInt(phiDays, 10) : null,
        rei_hours: reiHours ? parseInt(reiHours, 10) : null,
        weather_conditions: weather.trim() || null,
        wind_speed: wind ? parseFloat(wind) : null,
        temperature: temp ? parseFloat(temp) : null,
        applicator: applicator.trim() || null,
        equipment: equipment.trim() || null,
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
          title: 'Log Spray',
          headerRight: () => (
            <Pressable onPress={() => void handleSave()} disabled={isAddingSpray}>
              <Text style={[styles.save, isAddingSpray && styles.disabled]}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FormSection label="PRODUCT">
          <FormField label="Product name *" value={productName} onChangeText={setProductName} placeholder="e.g. Serenade" />
          <FormField
            label="Active ingredient"
            value={activeIngredient}
            onChangeText={setActiveIngredient}
            placeholder="e.g. Bacillus subtilis"
          />
          <FormField label="Target" value={target} onChangeText={setTarget} placeholder="Powdery mildew, botrytis…" />
        </FormSection>

        <FormSection label="APPLICATION">
          <DateField label="Applied on" value={appliedOn} onChangeText={setAppliedOn} />
          <FormField label="Rate" value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="2.5" />
          <FormField label="Rate unit" value={rateUnit} onChangeText={setRateUnit} placeholder="L/ha, kg/ha, mL/100L" />
          <FormField
            label="Water volume (L/ha)"
            value={waterVolume}
            onChangeText={setWaterVolume}
            keyboardType="decimal-pad"
          />
        </FormSection>

        <FormSection label="COMPLIANCE">
          <FormField
            label="PHI (pre-harvest interval, days)"
            value={phiDays}
            onChangeText={setPhiDays}
            keyboardType="numeric"
          />
          <FormField
            label="REI (re-entry interval, hours)"
            value={reiHours}
            onChangeText={setReiHours}
            keyboardType="numeric"
          />
          <FormField label="Applicator" value={applicator} onChangeText={setApplicator} placeholder="Name / license #" />
          <FormField label="Equipment" value={equipment} onChangeText={setEquipment} placeholder="Sprayer model" />
        </FormSection>

        <FormSection label="CONDITIONS">
          <FormField label="Weather" value={weather} onChangeText={setWeather} placeholder="Clear, overcast, calm…" />
          <FormField label="Wind (km/h)" value={wind} onChangeText={setWind} keyboardType="decimal-pad" />
          <FormField label="Temperature (°C)" value={temp} onChangeText={setTemp} keyboardType="decimal-pad" />
          <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />
        </FormSection>

        <SaveButton label="Save spray record" onPress={() => void handleSave()} disabled={isAddingSpray} />
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
