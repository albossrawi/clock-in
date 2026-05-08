import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
}

export default function CircleButton({
  onPress,
  disabled,
  size = 110,
  color,
  icon,
  label,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={() => animateTo(0.94)}
          onPressOut={() => animateTo(1)}
          disabled={disabled}
          style={({ pressed }) => [
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
            },
            styles.circle,
            disabled && { opacity: 0.55 },
            pressed && { opacity: 0.92 },
          ]}
        >
          <MaterialCommunityIcons name={icon} size={Math.round(size * 0.42)} color="#fff" />
        </Pressable>
      </Animated.View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#f8fafc',
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
  },
});
