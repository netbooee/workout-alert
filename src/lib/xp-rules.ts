// How XP is earned, in words, for the welcome tour and the "How XP works" sheet.
// Keep in sync with the amounts in supabase/migrations (workout_xp, xp_events kinds).

export const XP_RULES: { emoji: string; what: string; xp: string }[] = [
  { emoji: '🏃', what: 'A workout that counts (Me → What counts; 30 min = 25 XP)', xp: '10–40' },
  { emoji: '📸', what: 'Add a photo to a workout', xp: '+25' },
  { emoji: '🔥', what: 'Hit your weekly goal', xp: '+50' },
  { emoji: '✅', what: 'A partner verifies your workout', xp: '+5' },
  { emoji: '🤝', what: 'Verify a partner’s workout (3 a day)', xp: '+2' },
  { emoji: '🎯', what: 'Finish a challenge', xp: '+100' },
];
