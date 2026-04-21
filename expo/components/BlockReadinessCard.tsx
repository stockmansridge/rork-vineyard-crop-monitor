import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import {
  ShieldCheck,
  Gauge,
  ChevronRight,
  Droplets,
  Snowflake,
  Leaf,
  Satellite,
  Eye,
  X,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import {
  type BlockReadinessSnapshot,
  type EngineReadiness,
  type ReadinessEngine,
  engineLabel,
  readinessStateLabel,
  readinessColor,
  READINESS_MEANING,
} from '@/lib/blockReadiness';

interface Props {
  vineyardId: string;
  snapshot: BlockReadinessSnapshot;
  testID?: string;
}

function EngineIcon({ engine, color, size = 16 }: { engine: ReadinessEngine; color: string; size?: number }) {
  switch (engine) {
    case 'irrigation':
      return <Droplets size={size} color={color} />;
    case 'frost':
      return <Snowflake size={size} color={color} />;
    case 'disease':
      return <Leaf size={size} color={color} />;
    case 'satellite':
      return <Satellite size={size} color={color} />;
    case 'scouting':
      return <Eye size={size} color={color} />;
  }
}

export default function BlockReadinessCard({ vineyardId, snapshot, testID }: Props) {
  const router = useRouter();
  const [detailEngine, setDetailEngine] = useState<EngineReadiness | null>(null);

  const overallCfg = readinessColor(snapshot.overallState);
  const pct = Math.round(snapshot.overallScore * 100);

  const engines: EngineReadiness[] = [
    snapshot.engines.irrigation,
    snapshot.engines.frost,
    snapshot.engines.disease,
    snapshot.engines.satellite,
    snapshot.engines.scouting,
  ];

  const openSetup = () => {
    setDetailEngine(null);
    router.push({ pathname: '/edit-block-profile', params: { id: vineyardId } });
  };

  return (
    <View style={styles.card} testID={testID ?? 'block-readiness-card'}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: overallCfg.bg }]}>
          <Gauge size={18} color={overallCfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Block readiness</Text>
          <Text style={[styles.overallText, { color: overallCfg.color }]}>
            {readinessStateLabel(snapshot.overallState)} · {pct}%
          </Text>
        </View>
        <View style={[styles.scorePill, { backgroundColor: overallCfg.bg, borderColor: overallCfg.border }]}>
          <ShieldCheck size={12} color={overallCfg.color} />
          <Text style={[styles.scorePillText, { color: overallCfg.color }]}>{pct}</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${pct}%`, backgroundColor: overallCfg.color },
          ]}
        />
      </View>

      <Text style={styles.subtitle}>
        Readiness means enough block inputs are configured for this advisory engine — not that the engine is fully mature or authoritative.
      </Text>

      <View style={styles.grid}>
        {engines.map((e) => {
          const cfg = readinessColor(e.state);
          return (
            <Pressable
              key={e.engine}
              onPress={() => setDetailEngine(e)}
              style={({ pressed }) => [
                styles.engineRow,
                { borderColor: cfg.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.engineIcon, { backgroundColor: cfg.bg }]}>
                <EngineIcon engine={e.engine} color={cfg.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.engineName}>{engineLabel(e.engine)}</Text>
                <Text style={[styles.engineState, { color: cfg.color }]} numberOfLines={1}>
                  {readinessStateLabel(e.state)}
                  {e.missing.length > 0 ? ` · ${e.missing.length} missing` : ''}
                </Text>
              </View>
              <ChevronRight size={14} color={Colors.textMuted} />
            </Pressable>
          );
        })}
      </View>

      <Modal
        visible={detailEngine != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailEngine(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setDetailEngine(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {detailEngine && (() => {
              const cfg = readinessColor(detailEngine.state);
              return (
                <>
                  <View style={styles.sheetHeader}>
                    <View style={[styles.sheetIconWrap, { backgroundColor: cfg.bg }]}>
                      <EngineIcon engine={detailEngine.engine} color={cfg.color} size={20} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetTitle}>{engineLabel(detailEngine.engine)} readiness</Text>
                      <Text style={[styles.sheetState, { color: cfg.color }]}>
                        {readinessStateLabel(detailEngine.state)} · {Math.round(detailEngine.score * 100)}%
                      </Text>
                    </View>
                    <Pressable onPress={() => setDetailEngine(null)} hitSlop={10}>
                      <X size={18} color={Colors.textSecondary} />
                    </Pressable>
                  </View>

                  <View
                    style={[
                      styles.summaryBox,
                      { backgroundColor: cfg.bg, borderColor: cfg.border },
                    ]}
                  >
                    {detailEngine.advisoryOnly ? (
                      <AlertTriangle size={14} color={cfg.color} />
                    ) : (
                      <ShieldCheck size={14} color={cfg.color} />
                    )}
                    <Text style={[styles.summaryText, { color: cfg.color }]}>
                      {detailEngine.summary}
                    </Text>
                  </View>

                  <View style={styles.maturityBox} testID="readiness-maturity-note">
                    <AlertTriangle size={12} color={Colors.textMuted} />
                    <Text style={styles.maturityText}>
                      {READINESS_MEANING}
                      {'\n\n'}
                      {detailEngine.maturityNote}
                    </Text>
                  </View>

                  <ScrollView style={styles.reqScroll} contentContainerStyle={styles.reqList}>
                    {detailEngine.missing.length > 0 && (
                      <>
                        <Text style={styles.reqSectionLabel}>Missing</Text>
                        {detailEngine.missing.map((r) => (
                          <View key={r.key} style={styles.reqRow}>
                            <Circle
                              size={14}
                              color={r.critical ? Colors.danger : Colors.warning}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.reqLabel}>
                                {r.label}
                                {r.critical && (
                                  <Text style={styles.criticalTag}>  CRITICAL</Text>
                                )}
                              </Text>
                              {r.hint && <Text style={styles.reqHint}>{r.hint}</Text>}
                            </View>
                          </View>
                        ))}
                      </>
                    )}
                    {detailEngine.satisfied.length > 0 && (
                      <>
                        <Text style={[styles.reqSectionLabel, { marginTop: 10 }]}>
                          Configured
                        </Text>
                        {detailEngine.satisfied.map((r) => (
                          <View key={r.key} style={styles.reqRow}>
                            <CheckCircle2 size={14} color={Colors.primary} />
                            <Text style={[styles.reqLabel, { flex: 1 }]}>{r.label}</Text>
                          </View>
                        ))}
                      </>
                    )}
                  </ScrollView>

                  {detailEngine.missing.length > 0 && (
                    <Pressable
                      onPress={openSetup}
                      style={({ pressed }) => [
                        styles.completeBtn,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.completeBtnText}>Complete block setup</Text>
                      <ArrowRight size={14} color={Colors.background} />
                    </Pressable>
                  )}
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  overallText: {
    fontSize: 16,
    fontWeight: '800' as const,
    marginTop: 2,
  },
  scorePill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  scorePillText: {
    fontSize: 12,
    fontWeight: '800' as const,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 3,
    overflow: 'hidden' as const,
    marginBottom: 10,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 12,
  },
  grid: {
    gap: 8,
  },
  engineRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    padding: 10,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 12,
    borderWidth: 1,
  },
  engineIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  engineName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  engineState: {
    fontSize: 11,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end' as const,
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    maxHeight: '85%' as const,
  },
  sheetHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  sheetIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sheetTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  sheetState: {
    fontSize: 12,
    fontWeight: '700' as const,
    marginTop: 2,
  },
  summaryBox: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 17,
    flex: 1,
  },
  reqScroll: {
    maxHeight: 360,
  },
  reqList: {
    gap: 8,
    paddingBottom: 8,
  },
  reqSectionLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  reqRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  reqLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  reqHint: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  criticalTag: {
    color: Colors.danger,
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  maturityBox: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.backgroundAlt,
  },
  maturityText: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  completeBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  completeBtnText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '800' as const,
  },
});
