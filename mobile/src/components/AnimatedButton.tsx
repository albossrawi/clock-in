import { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
  StyleProp,
  Platform,
} from 'react-native';

interface Props {
  label: string;
  color: string;             // base background, also used for glow
  onPress: () => void;
  disabled?: boolean;
  size?: 'big' | 'small';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Pill-shaped button with a colored shadow ("glow") and a small scale + opacity
 * press animation. Uses native driver so the animation runs on the UI thread.
 */
export default function AnimatedButton({
  label,
  color,
  onPress,
  disabled,
  size = 'big',
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

  return (
    <Animated.View
      style={[
        { transform: [{ scale }] },
        // Coloured drop-shadow gives a glow on iOS; Android uses elevation
        // which can't be tinted, so we lean on the bright bg color instead.
        Platform.OS === 'ios'
          ? {
              shadowColor: color,
              shadowOpacity: disabled ? 0 : 0.5,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
            }
          : { elevation: disabled ? 0 : 6 },
        style,
      ]}
    >
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
        <Text style={[textSize, textStyle]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  big: {
    paddingVertical: 28,
    borderRadius: 999,
    alignItems: 'center',
  },
  small: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    alignSelf: 'center',
  },
  bigText: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: 0.3 },
  smallText: { color: '#f8fafc', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.92 },
});
