import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Colors from '@/constants/colors';

interface HealthBarProps {
  score: number;
  height?: number;
  showLabel?: boolean;
}

export default function HealthBar({ score, height = 6, showLabel = true }: HealthBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  const getColor = () => {
    if (score >= 80) return Colors.primary;
    if (score >= 60) return Colors.warning;
    return Colors.danger;
  };

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: score,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [score, animatedWidth]);

  return (
    <View style={styles.container}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={[styles.score, { color: getColor() }]}>{score}%</Text>
        </View>
      )}
      <View style={[styles.track, { height }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              height,
              backgroundColor: getColor(),
              width: animatedWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  score: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  track: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: 4,
  },
});
