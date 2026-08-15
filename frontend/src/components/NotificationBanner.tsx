import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing } from '../theme';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type?: 'info' | 'success' | 'warning';
}

interface NotificationBannerProps {
  notification: NotificationItem | null;
  onDismiss: () => void;
}

export function NotificationBanner({ notification, onDismiss }: NotificationBannerProps) {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.icon}>🔔</Text>
        <View style={styles.textGroup}>
          <Text style={styles.title}>{notification.title}</Text>
          <Text style={styles.body}>{notification.body}</Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={onDismiss}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderColor: '#38BDF8',
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  icon: {
    fontSize: 20,
  },
  textGroup: {
    flex: 1,
  },
  title: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 14,
  },
  body: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeText: {
    color: '#64748B',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
