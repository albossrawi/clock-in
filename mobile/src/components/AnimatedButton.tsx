import { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  size?: 'big' | 'small';
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Pill-shaped button with a subtle scale + opacity press animation.
 * Native driver so the animation runs on the UI thread.
 */
export default function AnimatedButton({
  label,
  color,
  onPress,
  disabled,
  size = 'big',
  icon,
  style,
  textStyle,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  const sizeStyle = size === 'big' ? styles.big : styles.small;
  const textSize = size === 'big' ? styles.bigText : styles.smallText;
  const iconSize = size === 'big' ? 26 : 18;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(0.96)}
        onPressOut={() => animateTo(1)}
        disabled={disabled}
        style={({ pressed }) => [
          sizeStyle,
          { backgroundColor: color },
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.content}>
          {icon && <MaterialCommunityIcons name={icon} size={iconSize} color="#fff" />}
          <Text style={[textSize, textStyle]}>{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  big: {
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  small: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    alignSelf: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  bigText: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: 0.3 },
  smallText: { color: '#f8fafc', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.92 },
});

