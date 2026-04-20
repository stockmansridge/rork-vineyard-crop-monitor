import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, MapPin, ChevronRight, Inbox } from 'lucide-react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import HealthBar from '@/components/HealthBar';
import { useVineyards } from '@/providers/VineyardProvider';
import { useAuth } from '@/providers/AuthProvider';

export default function FieldsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { vineyards, isLoading, isRefetching, refetch } = useVineyards();

  const totalArea = vineyards.reduce((sum, v) => sum + v.area, 0);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/add-field')}
              style={({ pressed }) => [styles.addHeaderBtn, pressed && styles.pressed]}
            >
              <Plus size={20} color={Colors.primary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{vineyards.length}</Text>
                <Text style={styles.summaryLabel}>Total Fields</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{totalArea.toFixed(1)}</Text>
                <Text style={styles.summaryLabel}>Total Hectares</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: Colors.primary }]}>
                  {vineyards.filter(v => v.owner_id !== user?.id).length}
                </Text>
                <Text style={styles.summaryLabel}>Shared</Text>
              </View>
            </View>

            {vineyards.length === 0 ? (
              <View style={styles.emptyCard}>
                <Inbox size={32} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No vineyards yet</Text>
                <Text style={styles.emptyText}>
                  Add your first vineyard to start monitoring
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                  onPress={() => router.push('/add-field')}
                >
                  <Plus size={16} color={Colors.background} />
                  <Text style={styles.addBtnText}>Add Vineyard</Text>
                </Pressable>
              </View>
            ) : (
              vineyards.map((vineyard) => {
                const isShared = vineyard.owner_id !== user?.id;
                return (
                  <Pressable
                    key={vineyard.id}
                    style={({ pressed }) => [styles.fieldCard, pressed && styles.pressed]}
                    onPress={() => router.push({ pathname: '/field-detail', params: { id: vineyard.id } })}
                  >
                    <View style={styles.fieldContent}>
                      <View style={styles.fieldHeader}>
                        <View style={styles.fieldTitleRow}>
                          <Text style={styles.fieldName}>{vineyard.name}</Text>
                          {isShared && (
                            <View style={styles.sharedBadge}>
                              <Text style={styles.sharedBadgeText}>Shared</Text>
                            </View>
                          )}
                        </View>
                        <ChevronRight size={18} color={Colors.textMuted} />
                      </View>
                      <Text style={styles.fieldVariety}>{vineyard.variety}</Text>
                      <View style={styles.fieldMeta}>
                        <View style={styles.metaItem}>
                          <MapPin size={12} color={Colors.textMuted} />
                          <Text style={styles.metaText}>{vineyard.area.toFixed(1)} {vineyard.area_unit}</Text>
                        </View>
                        {vineyard.planting_date && (
                          <>
                            <Text style={styles.metaDivider}>·</Text>
                            <Text style={styles.metaText}>
                              Planted {new Date(vineyard.planting_date).getFullYear()}
                            </Text>
                          </>
                        )}
                      </View>
                      <View style={styles.healthRow}>
                        <Text style={styles.healthLabel}>Health</Text>
                        <View style={styles.healthBarContainer}>
                          <HealthBar score={vineyard.health_score} height={5} />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}
          </>
        )}

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
  addHeaderBtn: {
    padding: 4,
  },
  pressed: {
    opacity: 0.8,
  },
  loadingContainer: {
    paddingTop: 60,
    alignItems: 'center' as const,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800' as const,
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 40,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center' as const,
    gap: 10,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center' as const,
  },
  addBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  addBtnText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  fieldCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    marginBottom: 12,
  },
  fieldContent: {
    padding: 14,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  fieldName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  sharedBadge: {
    backgroundColor: Colors.infoMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sharedBadgeText: {
    color: Colors.info,
    fontSize: 10,
    fontWeight: '700' as const,
  },
  fieldVariety: {
    color: Colors.secondary,
    fontSize: 13,
    fontWeight: '600' as const,
    marginTop: 4,
  },
  fieldMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  metaDivider: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  healthLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  healthBarContainer: {
    flex: 1,
  },
  bottomSpacer: {
    height: 20,
  },
});
