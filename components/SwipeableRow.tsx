import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

export function SwipeableRow({
  children,
  onDelete,
  label = 'Delete',
}: {
  children: ReactNode;
  onDelete: () => void;
  label?: string;
}) {
  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <Pressable style={styles.action} onPress={onDelete}>
          <Text style={styles.actionText}>{label}</Text>
        </Pressable>
      )}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 88,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginBottom: 8,
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
