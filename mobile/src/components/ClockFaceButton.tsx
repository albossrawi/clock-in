import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  /** Ring + accent (hands hub + complication border) color */
  accent: string;
  /** Icon shown inside the lower complication */
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Optional label rendered below the watch face */
  label?: string;
}

/**
 * Circular watch-face button.
 *
 * Visually:
 *   - outer ring with hour numbers 1..12
 *   - hour + minute + second hands following the device's current time (live)
 *   - small "complication" disc in the lower half showing the action icon
 *
 * Tap anywhere on the face to fire onPress. Includes scale-on-press animation.
 */
export default function ClockFaceButton({
  onPress,
  disabled,
  size = 260,
  accent,
  icon,
  label,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const C = size / 2;
  const OUTER = C - 4;
  const NUMBER_R = OUTER - size * 0.09;
  const HOUR_HAND = OUTER * 0.55;
  const MIN_HAND = OUTER * 0.78;
  const SEC_HAND = OUTER * 0.85;

  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  const hourDeg = h * 30 + m * 0.5;
  const minDeg = m * 6 + s * 0.1;
  const secDeg = s * 6;

  const polar = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: C + Math.cos(rad) * r, y: C + Math.sin(rad) * r };
  };

  const animateTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  const hourTip = polar(hourDeg, HOUR_HAND);
  const minTip = polar(minDeg, MIN_HAND);
  const secTip = polar(secDeg, SEC_HAND);

  const numberFontSize = Math.round(size * 0.07);
  const iconSize = Math.round(size * 0.13);
  const complicationPadH = size * 0.04;
  const complicationPadV = size * 0.012;
  const complicationH = iconSize + complicationPadV * 2;

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={() => animateTo(0.96)}
          onPressOut={() => animateTo(1)}
          disabled={disabled}
          style={({ pressed }) => [
            { width: size, height: size },
            disabled && { opacity: 0.6 },
            pressed && { opacity: 0.94 },
          ]}
        >
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Circle cx={C} cy={C} r={OUTER} fill="#1e293b" stroke={accent} strokeWidth={3} />

            {/* Hour numbers */}
            {Array.from({ length: 12 }, (_, i) => {
              const num = i + 1;
              const p = polar(num * 30, NUMBER_R);
              return (
                <SvgText
                  key={num}
                  x={p.x}
                  y={p.y + numberFontSize * 0.35}
                  fontSize={numberFontSize}
                  fontWeight="600"
                  fill="#cbd5e1"
                  textAnchor="middle"
                >
                  {num}
                </SvgText>
              );
            })}

            {/* Minor minute ticks */}
            {Array.from({ length: 60 }, (_, i) => {
              if (i % 5 === 0) return null;
              const a = polar(i * 6, OUTER - 4);
              const b = polar(i * 6, OUTER - 9);
              return (
                <Line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#475569"
                  strokeWidth={1}
                />
              );
            })}

            {/* Hour hand */}
            <Line
              x1={C}
              y1={C}
              x2={hourTip.x}
              y2={hourTip.y}
              stroke="#f8fafc"
              strokeWidth={Math.max(3, size * 0.018)}
              strokeLinecap="round"
            />
            {/* Minute hand */}
            <Line
              x1={C}
              y1={C}
              x2={minTip.x}
              y2={minTip.y}
              stroke="#f8fafc"
              strokeWidth={Math.max(2, size * 0.012)}
              strokeLinecap="round"
            />
            {/* Second hand */}
            <Line
              x1={C}
              y1={C}
              x2={secTip.x}
              y2={secTip.y}
              stroke={accent}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          </Svg>

          {/* Icon complication centered on the dial — covers the hub
              so the hands sweep around it like a watch logo. */}
          <View
            pointerEvents="none"
            style={[
              styles.complication,
              {
                top: C - complicationH / 2,
                paddingHorizontal: complicationPadH,
                paddingVertical: complicationPadV,
                borderRadius: size,
                borderColor: accent,
                backgroundColor: '#0f172a',
              },
            ]}
          >
            <MaterialCommunityIcons name={icon} size={iconSize} color={accent} />
          </View>
        </Pressable>
      </Animated.View>

      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  complication: {
    position: 'absolute',
    alignSelf: 'center',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#f8fafc',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
