import {
  AccessoryWidgetBackground,
  Circle,
  Divider,
  Gauge,
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  lineLimit,
  minimumScaleFactor,
  opacity,
  resizable,
  strokeBorder,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetProps } from '@/lib/widget';

/**
 * The Sigamos widget: your buddy, your streak, this week, and the one thing that
 * matters right now. What it says comes from lib/widget.ts; this only draws it.
 *
 * Runs in the widget's own isolated runtime: only Expo UI views, no hooks, and nothing
 * from outside this function (even constants must live inside it).
 */
const StreakWidget = (props: WidgetProps, environment: WidgetEnvironment) => {
  'widget';
  // Before the app has handed over any data (the widget gallery, or right after
  // installing), show a sample instead of failing to draw.
  const p: WidgetProps =
    props && Array.isArray(props.dots)
      ? props
      : {
          mascot: 'lotl',
          mood: 'happy',
          image: null,
          streak: 6,
          headline: '2 more days',
          detail: 'by Sunday to keep 6 weeks',
          urgent: false,
          dots: ['done', 'missed', 'done', 'missed', 'today', 'future', 'future'],
          weekDays: 2,
          weekGoal: 4,
          resting: false,
          reminder: null,
          url: 'sigamos:///',
        };
  const dark = environment.colorScheme !== 'light';
  const c = {
    background: dark ? '#1C1C26' : '#FFFFFF',
    text: dark ? '#F5F5F7' : '#0B0B0F',
    secondary: dark ? '#A1A1AB' : '#5F5F6B',
    faint: dark ? '#3A3A46' : '#E3E3E8',
    flame: '#FF6B1A',
    urgent: dark ? '#FF8A4C' : '#C2410C',
    rest: '#8B96E9',
  };
  const accent = p.resting ? c.rest : c.flame;
  const rounded = (size: number, weight: 'semibold' | 'bold' | 'heavy' | 'black' = 'bold') =>
    font({ design: 'rounded', size, weight });
  const icons = {
    bell: 'bell.fill',
    gift: 'gift.fill',
    person: 'person.badge.plus',
    eyes: 'eyes',
    trophy: 'trophy.fill',
  } as const;
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const dot = (state: WidgetProps['dots'][number], size: number) =>
    state === 'today' ? (
      <Circle modifiers={[strokeBorder({ color: accent, style: { lineWidth: 2 } }), frame({ width: size, height: size })]} />
    ) : (
      <Circle
        modifiers={[
          foregroundStyle(state === 'done' ? accent : c.faint),
          frame({ width: size, height: size }),
          opacity(state === 'missed' ? 0.55 : 1),
        ]}
      />
    );

  const buddy = (width: number) =>
    p.image ? (
      <Image uiImage={p.image} modifiers={[resizable(), frame({ width, height: width * 1.2 })]} />
    ) : (
      <Image systemName="flame.fill" size={width * 0.6} color={accent} />
    );

  const streakBadge = (size: number, suffix = '') =>
    p.streak == null ? null : (
      <HStack spacing={3}>
        <Image systemName="flame.fill" size={size * 0.85} color={accent} />
        <Text modifiers={[rounded(size, 'black'), foregroundStyle(c.text)]}>{`${p.streak}${suffix}`}</Text>
      </HStack>
    );

  const words = (
    <VStack alignment="leading" spacing={1}>
      <Text modifiers={[rounded(16, 'black'), foregroundStyle(p.urgent ? c.urgent : c.text), lineLimit(1), minimumScaleFactor(0.8)]}>
        {p.headline}
      </Text>
      <Text modifiers={[rounded(12, 'semibold'), foregroundStyle(c.secondary), lineLimit(2)]}>{p.detail}</Text>
    </VStack>
  );

  // ─── Lock Screen: one color, tinted by the system, and no names. ──────────────
  if (environment.widgetFamily === 'accessoryInline') {
    const streak = p.streak == null ? '' : `🔥${p.streak} · `;
    return <Text modifiers={[widgetURL(p.url)]}>{`${streak}${p.headline}`}</Text>;
  }

  if (environment.widgetFamily === 'accessoryCircular') {
    return (
      <ZStack modifiers={[widgetURL(p.url)]}>
        <AccessoryWidgetBackground />
        <Gauge
          value={Math.min(p.weekDays, p.weekGoal)}
          min={0}
          max={p.weekGoal}
          modifiers={[gaugeStyle('circularCapacity')]}
          currentValueLabel={
            <VStack spacing={0}>
              <Image systemName={p.resting ? 'moon.zzz.fill' : 'flame.fill'} size={11} />
              <Text modifiers={[rounded(18, 'black')]}>{p.streak == null ? '–' : `${p.streak}`}</Text>
            </VStack>
          }
        />
      </ZStack>
    );
  }

  if (environment.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[widgetURL(p.url)]}>
        <HStack spacing={4}>
          <Image systemName={p.resting ? 'moon.zzz.fill' : 'flame.fill'} size={13} />
          <Text modifiers={[rounded(15, 'black')]}>
            {p.streak == null ? 'Sigamos' : `${p.streak}-week streak`}
          </Text>
        </HStack>
        <Text modifiers={[rounded(14, 'semibold'), lineLimit(1)]}>{p.headline}</Text>
        <Text modifiers={[rounded(13, 'semibold'), opacity(0.7), lineLimit(1)]}>
          {p.reminder?.privateText ?? p.detail}
        </Text>
      </VStack>
    );
  }

  // ─── Home screen, medium: buddy, the week, and one reminder. ──────────────────
  if (environment.widgetFamily === 'systemMedium') {
    return (
      <HStack spacing={14} modifiers={[containerBackground(c.background, 'widget'), widgetURL(p.url)]}>
        <VStack spacing={4}>
          {buddy(84)}
          {streakBadge(14, p.streak === 1 ? ' week' : ' weeks')}
        </VStack>
        <VStack alignment="leading" spacing={8}>
          {words}
          <HStack spacing={0}>
            {p.dots.map((state, i) => (
              <VStack key={i} spacing={4} modifiers={[frame({ maxWidth: 1000 })]}>
                <Text modifiers={[rounded(10, 'heavy'), foregroundStyle(state === 'today' ? accent : c.secondary)]}>
                  {labels[i]}
                </Text>
                {dot(state, 12)}
              </VStack>
            ))}
          </HStack>
          {p.reminder && (
            <VStack alignment="leading" spacing={6}>
              <Divider />
              <HStack spacing={6}>
                <Image systemName={icons[p.reminder.icon]} size={13} color={c.urgent} />
                <Text modifiers={[rounded(12, 'bold'), foregroundStyle(c.text), lineLimit(1), minimumScaleFactor(0.85)]}>
                  {p.reminder.text}
                </Text>
              </HStack>
            </VStack>
          )}
        </VStack>
      </HStack>
    );
  }

  // ─── Home screen, small: buddy, streak, one message, and the week's dots. ─────
  return (
    <VStack alignment="leading" spacing={6} modifiers={[containerBackground(c.background, 'widget'), widgetURL(p.url)]}>
      <HStack alignment="top">
        {buddy(54)}
        <Spacer />
        {streakBadge(17)}
      </HStack>
      <Spacer />
      {words}
      <HStack spacing={5}>{p.dots.map((state, i) => <ZStack key={i}>{dot(state, 10)}</ZStack>)}</HStack>
    </VStack>
  );
};

export default createWidget('StreakWidget', StreakWidget);
