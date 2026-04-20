import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert, Pressable, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useRecords, TaskType } from '@/providers/RecordsProvider';
import {
  FormSection,
  FormField,
  ChipRow,
  DateField,
  SaveButton,
} from '@/components/RecordFormFields';

const TASK_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'pruning', label: 'Pruning' },
  { value: 'spraying', label: 'Spraying' },
  { value: 'harvesting', label: 'Harvesting' },
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'fertilizing', label: 'Fertilizing' },
  { value: 'canopy', label: 'Canopy Mgmt' },
  { value: 'scouting', label: 'Scouting' },
  { value: 'other', label: 'Other' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AddTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addTask, isAddingTask } = useRecords();

  const [taskType, setTaskType] = useState<TaskType>('pruning');
  const [title, setTitle] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [scheduledFor, setScheduledFor] = useState<string>(todayISO());
  const [status, setStatus] = useState<'planned' | 'completed'>('completed');
  const [laborHours, setLaborHours] = useState<string>('');
  const [cost, setCost] = useState<string>('');

  const handleSave = async () => {
    if (!id) return;
    if (!title.trim()) {
      Alert.alert('Missing info', 'Please enter a title.');
      return;
    }
    try {
      const dateISO = new Date(scheduledFor).toISOString();
      await addTask({
        vineyard_id: id,
        task_type: taskType,
        title: title.trim(),
        notes: notes.trim() || null,
        status,
        scheduled_for: dateISO,
        completed_at: status === 'completed' ? dateISO : null,
        duration_hours: null,
        labor_hours: laborHours ? parseFloat(laborHours) : null,
        cost: cost ? parseFloat(cost) : null,
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
          title: 'Log Task',
          headerRight: () => (
            <Pressable onPress={() => void handleSave()} disabled={isAddingTask}>
              <Text style={[styles.save, isAddingTask && styles.disabled]}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FormSection label="TYPE">
          <ChipRow label="Task type" options={TASK_OPTIONS} value={taskType} onChange={setTaskType} />
          <ChipRow
            label="Status"
            options={[
              { value: 'planned', label: 'Planned' },
              { value: 'completed', label: 'Completed' },
            ]}
            value={status}
            onChange={setStatus}
          />
        </FormSection>

        <FormSection label="DETAILS">
          <FormField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Cane prune Block A" />
          <DateField label="Date" value={scheduledFor} onChangeText={setScheduledFor} />
          <FormField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Observations, issues, details…"
            multiline
          />
        </FormSection>

        <FormSection label="RESOURCES (optional)">
          <FormField label="Labor hours" value={laborHours} onChangeText={setLaborHours} keyboardType="decimal-pad" />
          <FormField label="Cost ($)" value={cost} onChangeText={setCost} keyboardType="decimal-pad" />
        </FormSection>

        <SaveButton label="Save task" onPress={() => void handleSave()} disabled={isAddingTask} />
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
