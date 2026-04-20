import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Check,
  Circle,
  MapPin,
  Camera,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Trash2,
  CheckCircle2,
  XCircle,
  Play,
  Ban,
  Droplets,
  Leaf,
  Bug,
  Wrench,
  Waves,
  NotebookPen,
  User,
  CalendarClock,
  Repeat,
  TrendingUp,
  TrendingDown,
  Minus,
  History as HistoryIcon,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useScoutTasks } from '@/providers/ScoutTasksProvider';
import { useVineyards } from '@/providers/VineyardProvider';
import {
  outcomeLabel,
  statusLabel,
  triggerLabel,
  followUpResultLabel,
  effectivenessLabel,
  type ActionEffectiveness,
  type FollowUpResult,
  type ScoutCheckPoint,
  type ScoutObservations,
  type ScoutOutcome,
  type ScoutStatus,
} from '@/lib/scoutTasks';
import { freshnessLabel } from '@/lib/dataTrust';

export default function ScoutTaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tasks, updateTask, deleteTask, isUpdating } = useScoutTasks();
  const { vineyards } = useVineyards();
  const task = tasks.find((t) => t.id === id);

  const [notes, setNotes] = useState<string>(task?.resolution_notes ?? '');
  const [action, setAction] = useState<string>(task?.action_taken ?? '');
  const [performedBy, setPerformedBy] = useState<string>(task?.performed_by ?? '');
  const [obs, setObs] = useState<ScoutObservations>(
    task?.observations ?? {
      canopyCondition: null,
      moistureStress: false,
      diseaseSymptoms: [],
      irrigationFault: [],
      drainageIssue: false,
    }
  );
  const [outcome, setOutcome] = useState<ScoutOutcome | null>(task?.outcome ?? null);
  const [followUpResult, setFollowUpResult] = useState<FollowUpResult | null>(
    task?.follow_up_result ?? null
  );
  const [followUpNotes, setFollowUpNotes] = useState<string>(task?.follow_up_notes ?? '');
  const [effectiveness, setEffectiveness] = useState<ActionEffectiveness | null>(
    task?.effectiveness ?? null
  );

  const vineyard = useMemo(
    () => vineyards.find((v) => v.id === task?.vineyard_id) ?? null,
    [vineyards, task?.vineyard_id]
  );

  if (!task) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Inspection' }} />
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Task not found</Text>
        </View>
      </View>
    );
  }

  const checkpoints: ScoutCheckPoint[] = task.check_points ?? [];

  const toggleCheck = async (cpId: string) => {
    const next = checkpoints.map((c) => (c.id === cpId ? { ...c, done: !c.done } : c));
    await updateTask(task.id, { check_points: next });
  };

  const setStatus = async (status: ScoutStatus) => {
    await updateTask(task.id, { status });
  };

  const handleResolve = async (finalOutcome: ScoutOutcome) => {
    const nowIso = new Date().toISOString();
    await updateTask(task.id, {
      status: 'resolved',
      outcome: finalOutcome,
      action_taken: action || null,
      action_at: action ? nowIso : null,
      performed_by: performedBy || null,
      resolution_notes: notes || null,
      observations: obs,
      inspected_at: nowIso,
    });
    router.back();
  };

  const handleMonitoring = async () => {
    const nowIso = new Date().toISOString();
    await updateTask(task.id, {
      status: 'monitoring',
      outcome: outcome ?? null,
      action_taken: action || null,
      action_at: action ? nowIso : null,
      performed_by: performedBy || null,
      resolution_notes: notes || null,
      observations: obs,
      inspected_at: nowIso,
    });
    router.back();
  };

  const handleFollowUp = async () => {
    if (!followUpResult) return;
    const nowIso = new Date().toISOString();
    const nextStatus: ScoutStatus =
      followUpResult === 'resolved' || followUpResult === 'improved'
        ? 'resolved'
        : followUpResult === 'unresolved' || followUpResult === 'worsened' || followUpResult === 'recurring'
        ? 'monitoring'
        : task.status;
    await updateTask(task.id, {
      status: nextStatus,
      follow_up_at: nowIso,
      follow_up_result: followUpResult,
      follow_up_notes: followUpNotes || null,
      effectiveness: effectiveness ?? null,
    });
    router.back();
  };

  const handleIgnore = () => {
    Alert.alert('Ignore task?', 'This will mark the task as not requiring action.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Ignore',
        style: 'destructive',
        onPress: () => void updateTask(task.id, { status: 'ignored' }).then(() => router.back()),
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete task?', 'This will remove the inspection permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void deleteTask(task.id).then(() => router.back()),
      },
    ]);
  };

  const saveObservations = async (next: ScoutObservations) => {
    setObs(next);
    await updateTask(task.id, { observations: next });
  };

  const toggleStress = (v: NonNullable<ScoutObservations['canopyCondition']>) => {
    const next = { ...obs, canopyCondition: obs.canopyCondition === v ? null : v };
    void saveObservations(next);
  };

  const toggleFault = (kind: 'moistureStress' | 'drainageIssue') => {
    const next = { ...obs, [kind]: !obs[kind] };
    void saveObservations(next);
  };

  const doneCount = checkpoints.filter((c) => c.done).length;
  const progress = checkpoints.length > 0 ? doneCount / checkpoints.length : 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Inspection',
          headerRight: () => (
            <Pressable onPress={handleDelete} hitSlop={8}>
              <Trash2 size={18} color={Colors.danger} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{task.title}</Text>
          <View style={styles.metaRow}>
            <MapPin size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{vineyard?.name ?? 'Block'}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{triggerLabel(task.trigger_kind)}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Clock size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{freshnessLabel(task.created_at)}</Text>
          </View>
          {task.reason && <Text style={styles.reason}>{task.reason}</Text>}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, styles.statusBadge(task.status)]}>
              <Text style={[styles.badgeText, { color: statusColor(task.status) }]}>
                {statusLabel(task.status)}
              </Text>
            </View>
            <View style={styles.badge}>
              <ShieldCheck size={10} color={Colors.textMuted} />
              <Text style={styles.badgeSubText}>{task.confidence} confidence</Text>
            </View>
            {task.outcome && (
              <View style={styles.badge}>
                <Text style={styles.badgeSubText}>{outcomeLabel(task.outcome)}</Text>
              </View>
            )}
          </View>
        </View>

        {task.status !== 'resolved' && (
          <View style={styles.actionRow}>
            {task.status === 'open' && (
              <Pressable
                onPress={() => void setStatus('in_progress')}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                disabled={isUpdating}
              >
                <Play size={14} color={Colors.info} />
                <Text style={[styles.actionBtnText, { color: Colors.info }]}>Start</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleIgnore}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              disabled={isUpdating}
            >
              <Ban size={14} color={Colors.textSecondary} />
              <Text style={[styles.actionBtnText, { color: Colors.textSecondary }]}>Ignore</Text>
            </Pressable>
          </View>
        )}

        {checkpoints.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Check points</Text>
              <Text style={styles.progressText}>
                {doneCount}/{checkpoints.length}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            {checkpoints.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => void toggleCheck(c.id)}
                style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
              >
                {c.done ? (
                  <CheckCircle2 size={20} color={Colors.primary} />
                ) : (
                  <Circle size={20} color={Colors.textMuted} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.checkLabel, c.done && styles.checkLabelDone]}>{c.label}</Text>
                  {c.hint && <Text style={styles.checkHint}>{c.hint}</Text>}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observations</Text>
          <Text style={styles.sectionHint}>What did you see on the block?</Text>

          <Text style={styles.subLabel}>Canopy condition</Text>
          <View style={styles.chipRow}>
            {(
              [
                { v: 'healthy', label: 'Healthy', Icon: Leaf, color: Colors.primary },
                { v: 'mild_stress', label: 'Mild stress', Icon: Leaf, color: Colors.info },
                { v: 'moderate_stress', label: 'Moderate', Icon: AlertTriangle, color: Colors.warning },
                { v: 'severe_stress', label: 'Severe', Icon: AlertTriangle, color: Colors.danger },
              ] as const
            ).map((opt) => {
              const active = obs.canopyCondition === opt.v;
              return (
                <Pressable
                  key={opt.v}
                  onPress={() => toggleStress(opt.v)}
                  style={({ pressed }) => [
                    styles.optChip,
                    active && { backgroundColor: opt.color + '20', borderColor: opt.color + '60' },
                    pressed && styles.pressed,
                  ]}
                >
                  <opt.Icon size={12} color={active ? opt.color : Colors.textSecondary} />
                  <Text style={[styles.optChipText, active && { color: opt.color }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.subLabel}>Signals</Text>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => toggleFault('moistureStress')}
              style={({ pressed }) => [
                styles.optChip,
                obs.moistureStress && { backgroundColor: Colors.infoMuted, borderColor: Colors.info + '60' },
                pressed && styles.pressed,
              ]}
            >
              <Droplets size={12} color={obs.moistureStress ? Colors.info : Colors.textSecondary} />
              <Text
                style={[styles.optChipText, obs.moistureStress && { color: Colors.info }]}
              >
                Moisture stress
              </Text>
            </Pressable>
            <Pressable
              onPress={() => toggleFault('drainageIssue')}
              style={({ pressed }) => [
                styles.optChip,
                obs.drainageIssue && { backgroundColor: Colors.warningMuted, borderColor: Colors.warning + '60' },
                pressed && styles.pressed,
              ]}
            >
              <Waves size={12} color={obs.drainageIssue ? Colors.warning : Colors.textSecondary} />
              <Text
                style={[styles.optChipText, obs.drainageIssue && { color: Colors.warning }]}
              >
                Drainage issue
              </Text>
            </Pressable>
            <View style={styles.optChip}>
              <Bug size={12} color={Colors.textMuted} />
              <Text style={styles.optChipText}>Disease · add in notes</Text>
            </View>
            <View style={styles.optChip}>
              <Wrench size={12} color={Colors.textMuted} />
              <Text style={styles.optChipText}>Irrigation fault · notes</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes & action</Text>
          <View style={styles.fieldRow}>
            <User size={14} color={Colors.textMuted} />
            <TextInput
              value={performedBy}
              onChangeText={setPerformedBy}
              placeholder="Performed by (name or initials)"
              placeholderTextColor={Colors.textMuted}
              style={[styles.input, { flex: 1 }]}
              testID="scout-performedby-input"
            />
          </View>
          <TextInput
            value={action}
            onChangeText={setAction}
            placeholder="Action taken (e.g. flushed line 3, flagged 2 emitters)"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            multiline
            testID="scout-action-input"
          />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Inspection notes, row specifics, photos to add later…"
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, { minHeight: 90 }]}
            multiline
            testID="scout-notes-input"
          />
          <View style={styles.photoPlaceholder}>
            <Camera size={14} color={Colors.textMuted} />
            <Text style={styles.photoText}>
              Photos & row pins can be added in a future update — jot references in notes for now.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resolve</Text>
          <Text style={styles.sectionHint}>
            Record the outcome so future recommendations can learn from this inspection.
          </Text>
          <View style={styles.outcomeRow}>
            {(
              [
                { v: 'confirmed' as ScoutOutcome, label: 'Confirmed', color: Colors.danger, Icon: AlertTriangle },
                { v: 'partial' as ScoutOutcome, label: 'Partial', color: Colors.warning, Icon: NotebookPen },
                { v: 'false_alarm' as ScoutOutcome, label: 'False alarm', color: Colors.primary, Icon: XCircle },
                { v: 'not_checked' as ScoutOutcome, label: 'Not checked', color: Colors.textSecondary, Icon: Circle },
              ]
            ).map((opt) => {
              const active = outcome === opt.v;
              return (
                <Pressable
                  key={opt.v}
                  onPress={() => setOutcome(active ? null : opt.v)}
                  style={({ pressed }) => [
                    styles.outcomeChip,
                    active && { backgroundColor: opt.color + '20', borderColor: opt.color + '60' },
                    pressed && styles.pressed,
                  ]}
                >
                  <opt.Icon size={14} color={active ? opt.color : Colors.textSecondary} />
                  <Text style={[styles.outcomeChipText, active && { color: opt.color }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.resolveActions}>
            <Pressable
              onPress={() => outcome && void handleResolve(outcome)}
              disabled={!outcome || isUpdating}
              style={({ pressed }) => [
                styles.resolveBtn,
                (!outcome || isUpdating) && styles.resolveBtnDisabled,
                pressed && styles.pressed,
              ]}
              testID="scout-resolve-btn"
            >
              <Check size={16} color={Colors.background} />
              <Text style={styles.resolveBtnText}>Mark resolved</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleMonitoring()}
              disabled={isUpdating}
              style={({ pressed }) => [
                styles.monitorBtn,
                isUpdating && styles.resolveBtnDisabled,
                pressed && styles.pressed,
              ]}
              testID="scout-monitor-btn"
            >
              <Eye size={14} color={Colors.info} />
              <Text style={styles.monitorBtnText}>Keep monitoring</Text>
            </Pressable>
          </View>
        </View>

        {(task.status === 'resolved' || task.status === 'monitoring' || task.action_taken) && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.rowAligned}>
                <Repeat size={14} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Follow-up</Text>
              </View>
              {task.follow_up_at && (
                <Text style={styles.progressText}>
                  {freshnessLabel(task.follow_up_at)}
                </Text>
              )}
            </View>
            <Text style={styles.sectionHint}>
              Check back after a few days — did the action actually help? This feeds future prioritisation.
            </Text>

            <Text style={styles.subLabel}>Result after follow-up</Text>
            <View style={styles.chipRow}>
              {(
                [
                  { v: 'resolved' as FollowUpResult, Icon: Check, color: Colors.primary },
                  { v: 'improved' as FollowUpResult, Icon: TrendingUp, color: Colors.primary },
                  { v: 'unresolved' as FollowUpResult, Icon: Minus, color: Colors.warning },
                  { v: 'worsened' as FollowUpResult, Icon: TrendingDown, color: Colors.danger },
                  { v: 'recurring' as FollowUpResult, Icon: Repeat, color: Colors.danger },
                ]
              ).map((opt) => {
                const active = followUpResult === opt.v;
                return (
                  <Pressable
                    key={opt.v}
                    onPress={() => setFollowUpResult(active ? null : opt.v)}
                    style={({ pressed }) => [
                      styles.optChip,
                      active && { backgroundColor: opt.color + '20', borderColor: opt.color + '60' },
                      pressed && styles.pressed,
                    ]}
                  >
                    <opt.Icon size={12} color={active ? opt.color : Colors.textSecondary} />
                    <Text style={[styles.optChipText, active && { color: opt.color }]}>
                      {followUpResultLabel(opt.v)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.subLabel}>Was the action effective?</Text>
            <View style={styles.chipRow}>
              {(
                [
                  { v: 'effective' as ActionEffectiveness, color: Colors.primary },
                  { v: 'partial' as ActionEffectiveness, color: Colors.warning },
                  { v: 'ineffective' as ActionEffectiveness, color: Colors.danger },
                  { v: 'unknown' as ActionEffectiveness, color: Colors.textSecondary },
                ]
              ).map((opt) => {
                const active = effectiveness === opt.v;
                return (
                  <Pressable
                    key={opt.v}
                    onPress={() => setEffectiveness(active ? null : opt.v)}
                    style={({ pressed }) => [
                      styles.optChip,
                      active && { backgroundColor: opt.color + '20', borderColor: opt.color + '60' },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.optChipText, active && { color: opt.color }]}>
                      {effectivenessLabel(opt.v)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={followUpNotes}
              onChangeText={setFollowUpNotes}
              placeholder="Follow-up notes (what did you see 3–7 days later?)"
              placeholderTextColor={Colors.textMuted}
              style={[styles.input, { minHeight: 70 }]}
              multiline
              testID="scout-followup-notes"
            />

            <Pressable
              onPress={() => void handleFollowUp()}
              disabled={!followUpResult || isUpdating}
              style={({ pressed }) => [
                styles.resolveBtn,
                (!followUpResult || isUpdating) && styles.resolveBtnDisabled,
                pressed && styles.pressed,
              ]}
              testID="scout-followup-btn"
            >
              <CalendarClock size={16} color={Colors.background} />
              <Text style={styles.resolveBtnText}>Save follow-up</Text>
            </Pressable>

            {task.follow_up_result && (
              <View style={styles.historyLine}>
                <HistoryIcon size={12} color={Colors.textMuted} />
                <Text style={styles.historySub}>
                  Previous follow-up: {followUpResultLabel(task.follow_up_result)}
                  {task.effectiveness ? ` · ${effectivenessLabel(task.effectiveness)}` : ''}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

function statusColor(s: ScoutStatus): string {
  switch (s) {
    case 'open':
      return Colors.warning;
    case 'in_progress':
      return Colors.info;
    case 'resolved':
      return Colors.primary;
    case 'ignored':
      return Colors.textMuted;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16 },
  header: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 8,
  },
  title: { color: Colors.text, fontSize: 18, fontWeight: '800' as const },
  metaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, flexWrap: 'wrap' as const },
  metaText: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' as const, textTransform: 'capitalize' as const },
  metaDot: { color: Colors.textMuted, fontSize: 11 },
  reason: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
  badgeRow: { flexDirection: 'row' as const, gap: 6, marginTop: 6, flexWrap: 'wrap' as const },
  badge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.backgroundAlt,
  },
  statusBadge: (s: ScoutStatus) => ({
    backgroundColor:
      s === 'open'
        ? Colors.warningMuted
        : s === 'in_progress'
        ? Colors.infoMuted
        : s === 'resolved'
        ? Colors.primaryMuted
        : Colors.backgroundAlt,
  }),
  badgeText: { fontSize: 10, fontWeight: '800' as const, letterSpacing: 0.3 },
  badgeSubText: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' as const, textTransform: 'capitalize' as const },
  actionRow: { flexDirection: 'row' as const, gap: 8 },
  actionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' as const },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 10,
  },
  sectionHeaderRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  sectionTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' as const },
  sectionHint: { color: Colors.textMuted, fontSize: 12, lineHeight: 16 },
  subLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' as const, marginTop: 4 },
  progressText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' as const },
  progressBar: { height: 4, backgroundColor: Colors.backgroundAlt, borderRadius: 2, overflow: 'hidden' as const },
  progressFill: { height: 4, backgroundColor: Colors.primary },
  checkRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    paddingVertical: 6,
  },
  checkLabel: { color: Colors.text, fontSize: 13, lineHeight: 18 },
  checkLabelDone: { color: Colors.textMuted, textDecorationLine: 'line-through' as const },
  checkHint: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  optChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  optChipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' as const },
  input: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    color: Colors.text,
    padding: 12,
    fontSize: 13,
    minHeight: 44,
  },
  photoPlaceholder: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed' as const,
    padding: 10,
  },
  photoText: { color: Colors.textMuted, fontSize: 11, flex: 1, lineHeight: 15 },
  outcomeRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  outcomeChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  outcomeChipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' as const },
  resolveActions: { gap: 8, marginTop: 6 },
  resolveBtn: {
    marginTop: 6,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
  },
  resolveBtnDisabled: { opacity: 0.5 },
  resolveBtnText: { color: Colors.background, fontSize: 14, fontWeight: '800' as const },
  monitorBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.infoMuted,
    borderRadius: 12,
    paddingVertical: 11,
  },
  monitorBtnText: { color: Colors.info, fontSize: 13, fontWeight: '700' as const },
  fieldRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  rowAligned: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  historyLine: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 6 },
  historySub: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' as const },
  pressed: { opacity: 0.8 },
  empty: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 32 },
  emptyTitle: { color: Colors.textSecondary, fontSize: 14 },
});
