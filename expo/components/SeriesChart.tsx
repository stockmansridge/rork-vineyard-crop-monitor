import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line, Path } from 'react-native-svg';
import Colors from '@/constants/colors';

export interface SeriesPoint {
  x: number;
  y: number;
  label?: string;
}

interface SeriesChartProps {
  points: SeriesPoint[];
  color: string;
  height?: number;
  width?: number;
  yMin?: number;
  yMax?: number;
  showDots?: boolean;
  showGrid?: boolean;
  showFill?: boolean;
  thresholdMin?: number | null;
  thresholdMax?: number | null;
  formatY?: (v: number) => string;
}

export default function SeriesChart({
  points,
  color,
  height = 140,
  width,
  yMin,
  yMax,
  showDots = true,
  showGrid = true,
  showFill = true,
  thresholdMin = null,
  thresholdMax = null,
  formatY,
}: SeriesChartProps) {
  const W = width ?? 320;
  const H = height;
  const padL = 32;
  const padR = 8;
  const padT = 8;
  const padB = 18;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const { minX, maxX, minY, maxY } = useMemo(() => {
    if (points.length === 0) {
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    }
    let miX = Infinity;
    let maX = -Infinity;
    let miY = Infinity;
    let maY = -Infinity;
    for (const p of points) {
      if (p.x < miX) miX = p.x;
      if (p.x > maX) maX = p.x;
      if (p.y < miY) miY = p.y;
      if (p.y > maY) maY = p.y;
    }
    if (miX === maX) maX = miX + 1;
    const lo = yMin ?? miY;
    const hi = yMax ?? maY;
    const pad = (hi - lo) * 0.08 || 0.05;
    return {
      minX: miX,
      maxX: maX,
      minY: yMin ?? lo - pad,
      maxY: yMax ?? hi + pad,
    };
  }, [points, yMin, yMax]);

  const toX = (x: number) => padL + ((x - minX) / (maxX - minX || 1)) * innerW;
  const toY = (y: number) => padT + innerH - ((y - minY) / (maxY - minY || 1)) * innerH;

  const polyline = points.map((p) => `${toX(p.x).toFixed(2)},${toY(p.y).toFixed(2)}`).join(' ');

  const areaPath = useMemo(() => {
    if (points.length < 2) return '';
    const first = points[0];
    const last = points[points.length - 1];
    const top = points.map((p) => `L ${toX(p.x).toFixed(2)} ${toY(p.y).toFixed(2)}`).join(' ');
    return `M ${toX(first.x).toFixed(2)} ${toY(minY).toFixed(2)} L ${toX(first.x).toFixed(2)} ${toY(first.y).toFixed(2)} ${top} L ${toX(last.x).toFixed(2)} ${toY(minY).toFixed(2)} Z`;
  }, [points, minY]);

  const yTicks = useMemo(() => {
    const step = (maxY - minY) / 3;
    return [0, 1, 2, 3].map((i) => minY + step * i);
  }, [minY, maxY]);

  const fmt = formatY ?? ((v: number) => v.toFixed(2));

  return (
    <View style={[styles.container, { width: W, height: H }]}>
      <Svg width={W} height={H}>
        {showGrid &&
          yTicks.map((t, i) => (
            <Line
              key={`g-${i}`}
              x1={padL}
              x2={W - padR}
              y1={toY(t)}
              y2={toY(t)}
              stroke={Colors.cardBorder}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          ))}
        {thresholdMin != null && thresholdMin >= minY && thresholdMin <= maxY && (
          <Line
            x1={padL}
            x2={W - padR}
            y1={toY(thresholdMin)}
            y2={toY(thresholdMin)}
            stroke={Colors.danger}
            strokeWidth={1}
            strokeDasharray="2,4"
            opacity={0.7}
          />
        )}
        {thresholdMax != null && thresholdMax >= minY && thresholdMax <= maxY && (
          <Line
            x1={padL}
            x2={W - padR}
            y1={toY(thresholdMax)}
            y2={toY(thresholdMax)}
            stroke={Colors.warning}
            strokeWidth={1}
            strokeDasharray="2,4"
            opacity={0.7}
          />
        )}
        {showFill && points.length >= 2 && (
          <Path d={areaPath} fill={color} opacity={0.15} />
        )}
        {points.length >= 2 && (
          <Polyline
            points={polyline}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {showDots &&
          points.map((p, i) => (
            <Circle
              key={`d-${i}`}
              cx={toX(p.x)}
              cy={toY(p.y)}
              r={i === points.length - 1 ? 4 : 2.5}
              fill={color}
              stroke={Colors.background}
              strokeWidth={i === points.length - 1 ? 2 : 0}
            />
          ))}
      </Svg>
      <View style={styles.yAxis} pointerEvents="none">
        {yTicks
          .slice()
          .reverse()
          .map((t, i) => (
            <Text key={`yt-${i}`} style={[styles.yLabel, { top: toY(t) - 7 }]}>
              {fmt(t)}
            </Text>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  yAxis: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 30,
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    fontSize: 9,
    color: Colors.textMuted,
    fontFamily: 'monospace',
  },
});
