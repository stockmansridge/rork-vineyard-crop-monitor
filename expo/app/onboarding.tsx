import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Leaf,
  Satellite,
  Droplets,
  Bell,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  FileText,
  CloudSun,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';

const { width } = Dimensions.get('window');

const ONBOARDING_KEY = 'vinewatch_onboarded_v1';

interface Slide {
  id: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  iconColor: string;
  iconBg: string;
  tagline: string;
  title: string;
  description: string;
  bullets?: { icon: React.ComponentType<{ size?: number; color?: string }>; text: string }[];
}

const SLIDES: Slide[] = [
  {
    id: 'welcome',
    icon: Leaf,
    iconColor: Colors.primary,
    iconBg: Colors.primaryMuted,
    tagline: 'WELCOME TO VINEWATCH',
    title: 'Precision vineyard\nmonitoring, simplified.',
    description:
      'VineWatch blends satellite intelligence, weather data, and ground probes to help you manage every block with confidence.',
  },
  {
    id: 'fields',
    icon: MapPin,
    iconColor: Colors.primary,
    iconBg: Colors.primaryMuted,
    tagline: 'STEP 01',
    title: 'Map your\nvineyards',
    description:
      'Draw polygons for each block to unlock hyper-local data — health scores, NDVI trends, and weather all anchored to your boundaries.',
    bullets: [
      { icon: MapPin, text: 'Draw boundaries for every block' },
      { icon: Leaf, text: 'Track variety, area, planting date' },
    ],
  },
  {
    id: 'satellite',
    icon: Satellite,
    iconColor: Colors.sentinel,
    iconBg: Colors.infoMuted,
    tagline: 'STEP 02',
    title: 'See beyond\nthe canopy',
    description:
      'Planet and Sentinel imagery refresh your vineyard health overlays automatically. Spot stress before it becomes visible on the ground.',
    bullets: [
      { icon: Satellite, text: 'NDVI, NDMI, NDRE, MSAVI indices' },
      { icon: Sparkles, text: 'Automated multi-season trends' },
    ],
  },
  {
    id: 'ground',
    icon: Droplets,
    iconColor: Colors.info,
    iconBg: Colors.infoMuted,
    tagline: 'STEP 03',
    title: 'Know your\nsoil & sky',
    description:
      'Connect soil probes for live moisture, pH and EC. Pick the Weather Underground station closest to each block for precise forecasts.',
    bullets: [
      { icon: Droplets, text: 'Soil probes with threshold alerts' },
      { icon: CloudSun, text: 'Personal weather station integration' },
    ],
  },
  {
    id: 'alerts',
    icon: Bell,
    iconColor: Colors.warning,
    iconBg: Colors.warningMuted,
    tagline: 'STEP 04',
    title: 'Stay ahead\nof risk',
    description:
      'Frost warnings, heat stress, disease pressure and probe anomalies — delivered as push notifications before damage is done.',
    bullets: [
      { icon: Bell, text: 'Frost, heat, rain & disease alerts' },
      { icon: FileText, text: 'Spray, harvest & compliance logs' },
    ],
  },
];

function Dot({ active, width: w }: { active: boolean; width: Animated.AnimatedInterpolation<number> }) {
  return (
    <Animated.View
      style={[
        styles.dot,
        { width: w, backgroundColor: active ? Colors.primary : Colors.cardBorder },
      ]}
    />
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState<number>(0);
  const isLast = index === SLIDES.length - 1;

  const finish = useCallback(async () => {
    try {
      if (user?.id) {
        await AsyncStorage.setItem(`${ONBOARDING_KEY}:${user.id}`, new Date().toISOString());
      }
    } catch (e) {
      console.log('[Onboarding] persist error', e);
    }
    router.replace('/add-field');
  }, [router, user?.id]);

  const skip = useCallback(async () => {
    try {
      if (user?.id) {
        await AsyncStorage.setItem(`${ONBOARDING_KEY}:${user.id}`, new Date().toISOString());
      }
    } catch (e) {
      console.log('[Onboarding] skip persist error', e);
    }
    router.replace('/(tabs)/(dashboard)');
  }, [router, user?.id]);

  const scrollTo = useCallback((i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
  }, []);

  const handleNext = () => {
    if (isLast) {
      void finish();
    } else {
      scrollTo(index + 1);
    }
  };

  const handleBack = () => {
    if (index > 0) scrollTo(index - 1);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    scrollX.setValue(x);
    const i = Math.round(x / width);
    if (i !== index) setIndex(i);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[Colors.background, Colors.backgroundAlt, Colors.background]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
        />

        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View style={styles.brandBadge}>
              <Leaf size={14} color={Colors.primary} />
            </View>
            <Text style={styles.brandName}>VineWatch</Text>
          </View>
          {!isLast && (
            <Pressable onPress={() => void skip()} hitSlop={8}>
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          )}
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          bounces={false}
          style={styles.scroll}
        >
          {SLIDES.map((s, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.8, 1, 0.8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            const translate = scrollX.interpolate({
              inputRange,
              outputRange: [40, 0, -40],
              extrapolate: 'clamp',
            });
            const Icon = s.icon;
            return (
              <View key={s.id} style={[styles.slide, { width }]}>
                <Animated.View style={[styles.iconOuter, { transform: [{ scale }], opacity }]}>
                  <View style={[styles.iconGlow, { backgroundColor: s.iconColor + '22' }]} />
                  <View style={[styles.iconInner, { backgroundColor: s.iconBg, borderColor: s.iconColor + '40' }]}>
                    <Icon size={46} color={s.iconColor} />
                  </View>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.textBlock,
                    { opacity, transform: [{ translateX: translate }] },
                  ]}
                >
                  <Text style={[styles.tagline, { color: s.iconColor }]}>{s.tagline}</Text>
                  <Text style={styles.title}>{s.title}</Text>
                  <Text style={styles.description}>{s.description}</Text>

                  {s.bullets && (
                    <View style={styles.bullets}>
                      {s.bullets.map((b, bi) => {
                        const BulletIcon = b.icon;
                        return (
                          <View key={bi} style={styles.bullet}>
                            <View style={[styles.bulletIcon, { backgroundColor: s.iconBg }]}>
                              <BulletIcon size={14} color={s.iconColor} />
                            </View>
                            <Text style={styles.bulletText}>{b.text}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </Animated.View>
              </View>
            );
          })}
        </Animated.ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.dotsRow}>
            {SLIDES.map((_, i) => {
              const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [8, 24, 8],
                extrapolate: 'clamp',
              });
              return <Dot key={i} active={i === index} width={dotWidth} />;
            })}
          </View>

          <View style={styles.controls}>
            <Pressable
              onPress={handleBack}
              disabled={index === 0}
              style={({ pressed }) => [
                styles.ghostBtn,
                index === 0 && styles.ghostBtnDisabled,
                pressed && !(index === 0) && styles.pressed,
              ]}
              hitSlop={8}
            >
              <ChevronLeft size={18} color={index === 0 ? Colors.textMuted : Colors.text} />
            </Pressable>

            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              testID="onboardingNext"
            >
              <Text style={styles.primaryBtnText}>
                {isLast ? 'Add my first vineyard' : 'Continue'}
              </Text>
              <ChevronRight size={18} color={Colors.background} />
            </Pressable>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary + '50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { color: Colors.text, fontSize: 14, fontWeight: '800' as const, letterSpacing: -0.3 },
  skip: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' as const },
  scroll: { flex: 1 },
  slide: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  iconOuter: { alignItems: 'center', justifyContent: 'center' },
  iconGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    ...(Platform.OS !== 'web'
      ? { shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 40 }
      : {}),
  },
  iconInner: {
    width: 128,
    height: 128,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { alignItems: 'center', maxWidth: 520 },
  tagline: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 2,
    marginBottom: 10,
  },
  title: {
    color: Colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800' as const,
    textAlign: 'center',
    letterSpacing: -0.7,
    marginBottom: 12,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  bullets: { gap: 10, marginTop: 12, width: '100%' },
  bullet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bulletIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: { color: Colors.text, fontSize: 13, fontWeight: '500' as const, flex: 1 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  dot: { height: 8, borderRadius: 4 },
  controls: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  ghostBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnDisabled: { opacity: 0.4 },
  primaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: { color: Colors.background, fontSize: 15, fontWeight: '800' as const, letterSpacing: -0.2 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
