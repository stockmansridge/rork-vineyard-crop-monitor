import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Alert } from '@/types';

interface AlertCardProps {
  alert: Alert;
  onPress?: () => void;
}

export default function AlertCard({ alert, onPress }: AlertCardProps) {
  const getAlertConfig = () => {
    switch (alert.type) {
      case 'danger':
        return { color: Colors.danger, bg: Colors.dangerMuted, Icon: AlertCircle };
      case 'warning':
        return { color: Colors.warning, bg: Colors.warningMuted, Icon: AlertTriangle };
      default:
        return { color: Colors.info, bg: Colors.infoMuted, Icon: Info };
    }
  };

  const config = getAlertConfig();
  const timeAgo = getTimeAgo(alert.timestamp);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        !alert.isRead && styles.unread,
        pressed ? styles.pressed : null,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: config.bg }]}>
        <config.Icon size={18} color={config.color} />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{alert.title}</Text>
          {!alert.isRead && <View style={[styles.dot, { backgroundColor: config.color }]} />}
        </View>
        <Text style={styles.message} numberOfLines={2}>{alert.message}</Text>
        <View style={styles.footer}>
          <Text style={styles.vineyard}>{alert.vineyardName}</Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 12,
  },
  unread: {
    borderColor: Colors.cardHover,
    backgroundColor: Colors.cardHover,
  },
  pressed: {
    opacity: 0.8,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
    flex: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  message: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  vineyard: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  time: {
    color: Colors.textMuted,
    fontSize: 11,
  },
});
