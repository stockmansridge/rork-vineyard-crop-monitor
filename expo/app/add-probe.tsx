import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { vineyards } from '@/mocks/vineyards';

const DEPTHS = ['15', '30', '45', '60', '90'];

export default function AddProbeScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [selectedVineyard, setSelectedVineyard] = useState('');
  const [depth, setDepth] = useState('30');
  const [mqttBroker, setMqttBroker] = useState('');
  const [topic, setTopic] = useState('');

  const handleSave = () => {
    if (!name.trim() || !selectedVineyard) {
      Alert.alert('Missing Fields', 'Please fill in probe name and select a vineyard.');
      return;
    }
    console.log('Saving probe:', { name, selectedVineyard, depth, mqttBroker, topic });
    Alert.alert('Probe Added', `${name} has been registered successfully.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={handleSave} style={({ pressed }) => [pressed && styles.pressed]}>
              <Text style={styles.saveBtn}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionHeader}>PROBE DETAILS</Text>
        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Probe Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Probe Alpha-3"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        <Text style={styles.sectionHeader}>ASSIGN TO VINEYARD</Text>
        <View style={styles.section}>
          {vineyards.map((v, i) => (
            <React.Fragment key={v.id}>
              {i > 0 && <View style={styles.divider} />}
              <Pressable
                style={[styles.vineyardRow, selectedVineyard === v.id && styles.vineyardRowActive]}
                onPress={() => setSelectedVineyard(v.id)}
              >
                <View>
                  <Text style={styles.vineyardName}>{v.name}</Text>
                  <Text style={styles.vineyardDetail}>{v.variety} · {v.area} {v.areaUnit}</Text>
                </View>
                {selectedVineyard === v.id && <Check size={18} color={Colors.primary} />}
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        <Text style={styles.sectionHeader}>SENSOR DEPTH (CM)</Text>
        <View style={styles.depthRow}>
          {DEPTHS.map((d) => (
            <Pressable
              key={d}
              style={[styles.depthChip, depth === d && styles.depthChipActive]}
              onPress={() => setDepth(d)}
            >
              <Text style={[styles.depthText, depth === d && styles.depthTextActive]}>{d}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionHeader}>MQTT CONNECTION (OPTIONAL)</Text>
        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Broker URL</Text>
            <TextInput
              style={styles.input}
              value={mqttBroker}
              onChangeText={setMqttBroker}
              placeholder="mqtt://broker.example.com:1883"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Topic</Text>
            <TextInput
              style={styles.input}
              value={topic}
              onChangeText={setTopic}
              placeholder="vineyard/probes/alpha-3"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
          </View>
        </View>

        <Pressable style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Register Probe</Text>
        </Pressable>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </>
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
  saveBtn: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  pressed: {
    opacity: 0.7,
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
  inputGroup: {
    padding: 14,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  input: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500' as const,
    padding: 0,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginLeft: 14,
  },
  vineyardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  vineyardRowActive: {
    backgroundColor: Colors.primaryMuted + '40',
  },
  vineyardName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  vineyardDetail: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  depthRow: {
    flexDirection: 'row',
    gap: 10,
  },
  depthChip: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  depthChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  depthText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  depthTextActive: {
    color: Colors.primary,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonPressed: {
    opacity: 0.8,
  },
  saveButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  bottomSpacer: {
    height: 40,
  },
});
