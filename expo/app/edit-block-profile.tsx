import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Alert, Pressable, Text, View, Switch } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useVineyards, BlockAgronomy } from '@/providers/VineyardProvider';
import {
  FormSection,
  FormField,
  ChipRow,
  SaveButton,
} from '@/components/RecordFormFields';

const TRAINING_OPTIONS = [
  { value: 'VSP', label: 'VSP' },
  { value: 'Scott Henry', label: 'Scott Henry' },
  { value: 'Sprawl', label: 'Sprawl' },
  { value: 'Geneva Double', label: 'GDC' },
  { value: 'Bush', label: 'Bush' },
  { value: 'Pergola', label: 'Pergola' },
  { value: 'Other', label: 'Other' },
] as const;

const PRUNING_OPTIONS = [
  { value: 'Cane', label: 'Cane' },
  { value: 'Spur', label: 'Spur' },
  { value: 'Minimal', label: 'Minimal' },
  { value: 'Mechanical', label: 'Mechanical' },
  { value: 'Other', label: 'Other' },
] as const;

const IRRIGATION_OPTIONS = [
  { value: 'drip', label: 'Drip' },
  { value: 'sprinkler', label: 'Sprinkler' },
  { value: 'flood', label: 'Flood' },
  { value: 'dryland', label: 'Dryland' },
  { value: 'other', label: 'Other' },
] as const;

const SOIL_OPTIONS = [
  { value: 'Sandy', label: 'Sandy' },
  { value: 'Loam', label: 'Loam' },
  { value: 'Clay', label: 'Clay' },
  { value: 'Silt', label: 'Silt' },
  { value: 'Gravel', label: 'Gravel' },
  { value: 'Volcanic', label: 'Volcanic' },
  { value: 'Limestone', label: 'Limestone' },
  { value: 'Other', label: 'Other' },
] as const;

const ASPECT_OPTIONS = [
  { value: 'N', label: 'N' },
  { value: 'NE', label: 'NE' },
  { value: 'E', label: 'E' },
  { value: 'SE', label: 'SE' },
  { value: 'S', label: 'S' },
  { value: 'SW', label: 'SW' },
  { value: 'W', label: 'W' },
  { value: 'NW', label: 'NW' },
] as const;

function n(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const parsed = Number(t);
  return isNaN(parsed) ? null : parsed;
}

function s(v: string | null | undefined): string {
  return v == null ? '' : String(v);
}

export default function EditBlockProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { vineyards, updateVineyard } = useVineyards();
  const vineyard = useMemo(() => vineyards.find((v) => v.id === id), [vineyards, id]);

  const [clone, setClone] = useState<string>(s(vineyard?.clone));
  const [rootstock, setRootstock] = useState<string>(s(vineyard?.rootstock));
  const [plantingDate, setPlantingDate] = useState<string>(s(vineyard?.planting_date));
  const [rowSpacing, setRowSpacing] = useState<string>(s(vineyard?.row_spacing_m));
  const [vineSpacing, setVineSpacing] = useState<string>(s(vineyard?.vine_spacing_m));
  const [trainingSystem, setTrainingSystem] = useState<string>(s(vineyard?.training_system) || 'VSP');
  const [pruningType, setPruningType] = useState<string>(s(vineyard?.pruning_type) || 'Cane');
  const [irrigationType, setIrrigationType] = useState<string>(s(vineyard?.irrigation_type) || 'drip');
  const [irrigationZone, setIrrigationZone] = useState<string>(s(vineyard?.irrigation_zone));
  const [emitterSpacing, setEmitterSpacing] = useState<string>(s(vineyard?.emitter_spacing_m));
  const [emitterFlow, setEmitterFlow] = useState<string>(s(vineyard?.emitter_flow_lph));
  const [soilType, setSoilType] = useState<string>(s(vineyard?.soil_type) || 'Loam');
  const [subsoilNotes, setSubsoilNotes] = useState<string>(s(vineyard?.subsoil_notes));
  const [drainageNotes, setDrainageNotes] = useState<string>(s(vineyard?.drainage_notes));
  const [slope, setSlope] = useState<string>(s(vineyard?.slope_pct));
  const [aspect, setAspect] = useState<string>(s(vineyard?.aspect) || 'N');
  const [elevation, setElevation] = useState<string>(s(vineyard?.elevation_m));
  const [frostRisk, setFrostRisk] = useState<boolean>(!!vineyard?.frost_risk);
  const [heatExposure, setHeatExposure] = useState<boolean>(!!vineyard?.heat_exposure);
  const [diseaseProne, setDiseaseProne] = useState<boolean>(!!vineyard?.disease_prone);
  const [lowVigor, setLowVigor] = useState<boolean>(!!vineyard?.low_vigor_history);
  const [waterlogging, setWaterlogging] = useState<boolean>(!!vineyard?.waterlogging_risk);
  const [targetYield, setTargetYield] = useState<string>(s(vineyard?.target_yield_t_per_ha));
  const [harvestStart, setHarvestStart] = useState<string>(s(vineyard?.normal_harvest_start));
  const [harvestEnd, setHarvestEnd] = useState<string>(s(vineyard?.normal_harvest_end));
  const [blockNotes, setBlockNotes] = useState<string>(s(vineyard?.block_notes));
  const [saving, setSaving] = useState<boolean>(false);

  if (!vineyard) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Block Profile' }} />
        <Text style={styles.empty}>Vineyard not found</Text>
      </View>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    const updates: Partial<BlockAgronomy> & { planting_date?: string | null } = {
      clone: clone.trim() || null,
      rootstock: rootstock.trim() || null,
      row_spacing_m: n(rowSpacing),
      vine_spacing_m: n(vineSpacing),
      training_system: trainingSystem.trim() || null,
      pruning_type: pruningType.trim() || null,
      irrigation_type: irrigationType.trim() || null,
      irrigation_zone: irrigationZone.trim() || null,
      emitter_spacing_m: n(emitterSpacing),
      emitter_flow_lph: n(emitterFlow),
      soil_type: soilType.trim() || null,
      subsoil_notes: subsoilNotes.trim() || null,
      drainage_notes: drainageNotes.trim() || null,
      slope_pct: n(slope),
      aspect: aspect.trim() || null,
      elevation_m: n(elevation),
      frost_risk: frostRisk,
      heat_exposure: heatExposure,
      disease_prone: diseaseProne,
      low_vigor_history: lowVigor,
      waterlogging_risk: waterlogging,
      target_yield_t_per_ha: n(targetYield),
      normal_harvest_start: harvestStart.trim() || null,
      normal_harvest_end: harvestEnd.trim() || null,
      block_notes: blockNotes.trim() || null,
      planting_date: plantingDate.trim() || null,
    };
    try {
      await updateVineyard(vineyard.id, updates);
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Block Profile',
          headerRight: () => (
            <Pressable onPress={() => void handleSave()} disabled={saving}>
              <Text style={[styles.save, saving && styles.disabled]}>Save</Text>
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
          <Text style={styles.headerSub}>
            {vineyard.area.toFixed(2)} {vineyard.area_unit} · Block profile
          </Text>
        </View>

        <FormSection label="PLANT MATERIAL">
          <FormField label="Clone" value={clone} onChangeText={setClone} placeholder="e.g. 115" />
          <FormField
            label="Rootstock"
            value={rootstock}
            onChangeText={setRootstock}
            placeholder="e.g. 101-14, 3309C"
          />
          <FormField
            label="Planting date"
            value={plantingDate}
            onChangeText={setPlantingDate}
            placeholder="YYYY-MM-DD"
          />
        </FormSection>

        <FormSection label="SPACING & TRAINING">
          <FormField
            label="Row spacing (m)"
            value={rowSpacing}
            onChangeText={setRowSpacing}
            keyboardType="decimal-pad"
          />
          <FormField
            label="Vine spacing (m)"
            value={vineSpacing}
            onChangeText={setVineSpacing}
            keyboardType="decimal-pad"
          />
          <ChipRow
            label="Training system"
            options={TRAINING_OPTIONS as unknown as { value: string; label: string }[]}
            value={trainingSystem}
            onChange={setTrainingSystem}
          />
          <ChipRow
            label="Pruning type"
            options={PRUNING_OPTIONS as unknown as { value: string; label: string }[]}
            value={pruningType}
            onChange={setPruningType}
          />
        </FormSection>

        <FormSection label="IRRIGATION">
          <ChipRow
            label="Irrigation type"
            options={IRRIGATION_OPTIONS as unknown as { value: string; label: string }[]}
            value={irrigationType}
            onChange={setIrrigationType}
          />
          <FormField
            label="Irrigation zone"
            value={irrigationZone}
            onChangeText={setIrrigationZone}
            placeholder="e.g. Zone 3"
          />
          <FormField
            label="Emitter spacing (m)"
            value={emitterSpacing}
            onChangeText={setEmitterSpacing}
            keyboardType="decimal-pad"
          />
          <FormField
            label="Emitter flow (L/h)"
            value={emitterFlow}
            onChangeText={setEmitterFlow}
            keyboardType="decimal-pad"
          />
        </FormSection>

        <FormSection label="SOIL & SITE">
          <ChipRow
            label="Soil type"
            options={SOIL_OPTIONS as unknown as { value: string; label: string }[]}
            value={soilType}
            onChange={setSoilType}
          />
          <FormField
            label="Subsoil notes"
            value={subsoilNotes}
            onChangeText={setSubsoilNotes}
            placeholder="e.g. hardpan at 60cm"
            multiline
          />
          <FormField
            label="Drainage notes"
            value={drainageNotes}
            onChangeText={setDrainageNotes}
            placeholder="e.g. poor drainage at headland"
            multiline
          />
          <FormField
            label="Slope (%)"
            value={slope}
            onChangeText={setSlope}
            keyboardType="decimal-pad"
          />
          <ChipRow
            label="Aspect"
            options={ASPECT_OPTIONS as unknown as { value: string; label: string }[]}
            value={aspect}
            onChange={setAspect}
          />
          <FormField
            label="Elevation (m)"
            value={elevation}
            onChangeText={setElevation}
            keyboardType="decimal-pad"
          />
        </FormSection>

        <FormSection label="RISK FLAGS">
          <ToggleRow label="Frost risk" value={frostRisk} onValueChange={setFrostRisk} />
          <ToggleRow label="Heat exposure" value={heatExposure} onValueChange={setHeatExposure} />
          <ToggleRow label="Disease-prone" value={diseaseProne} onValueChange={setDiseaseProne} />
          <ToggleRow label="Low vigor history" value={lowVigor} onValueChange={setLowVigor} />
          <ToggleRow label="Waterlogging risk" value={waterlogging} onValueChange={setWaterlogging} />
        </FormSection>

        <FormSection label="YIELD & HARVEST WINDOW">
          <FormField
            label="Target yield (t/ha)"
            value={targetYield}
            onChangeText={setTargetYield}
            keyboardType="decimal-pad"
          />
          <FormField
            label="Normal harvest start"
            value={harvestStart}
            onChangeText={setHarvestStart}
            placeholder="e.g. Mar 01 or MM-DD"
          />
          <FormField
            label="Normal harvest end"
            value={harvestEnd}
            onChangeText={setHarvestEnd}
            placeholder="e.g. Mar 20 or MM-DD"
          />
        </FormSection>

        <FormSection label="NOTES">
          <FormField
            label="Block notes"
            value={blockNotes}
            onChangeText={setBlockNotes}
            placeholder="Anything the team should remember…"
            multiline
          />
        </FormSection>

        <SaveButton label="Save block profile" onPress={() => void handleSave()} disabled={saving} />
      </ScrollView>
    </>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.cardBorder, true: Colors.primaryMuted }}
        thumbColor={value ? Colors.primary : Colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 60 },
  save: { color: Colors.primary, fontSize: 15, fontWeight: '700' as const },
  disabled: { opacity: 0.5 },
  empty: {
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    padding: 40,
  },
  headerBlock: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 4,
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
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 4,
  },
  toggleLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
