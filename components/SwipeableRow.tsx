import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

export function SwipeableRow({
  children,
  onDelete,
  label = 'Delete',
  onComplete,
  completeLabel = 'Done',
}: {
  children: ReactNode;
  onDelete: () => void;
  label?: string;
  onComplete?: () => void;
  completeLabel?: string;
}) {
  const ref = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={ref}
      overshootRight={false}
      overshootLeft={false}
      renderRightActions={() => (
        <Pressable
          style={[styles.action, styles.deleteAction]}
          onPress={() => {
            ref.current?.close();
            onDelete();
          }}
        >
          <Text style={styles.actionText}>{label}</Text>
        </Pressable>
      )}
      renderLeftActions={
        onComplete
          ? () => (
              <Pressable
                style={[styles.action, styles.completeAction]}
                onPress={() => {
                  ref.current?.close();
                  onComplete();
                }}
              >
                <Text style={styles.actionText}>{completeLabel}</Text>
              </Pressable>
            )
          : undefined
      }
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginBottom: 8,
  },
  deleteAction: { backgroundColor: '#DC2626' },
  completeAction: { backgroundColor: '#16A34A' },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
