import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { FeedCard } from '@/components/feed-card';
import { LeagueCard } from '@/components/league-card';
import { PartnerCard } from '@/components/partner-card';
import { AppText, Button, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useLeague, useNames, usePartnerFeed, usePartners, useRespondToPartner } from '@/hooks/use-social';
import type { Partner } from '@/lib/database.types';

export default function PartnersScreen() {
  const partners = usePartners();
  const league = useLeague();
  const feed = usePartnerFeed();
  const nameOf = useNames();

  const all = partners.data ?? [];
  const accepted = all.filter((p) => p.status === 'accepted');
  const incoming = all.filter((p) => p.status === 'pending' && p.incoming);
  const outgoing = all.filter((p) => p.status === 'pending' && !p.incoming);
  const refreshing = partners.isRefetching || feed.isRefetching || league.isRefetching;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={Colors.flame}
            onRefresh={() => {
              partners.refetch();
              feed.refetch();
              league.refetch();
            }}
          />
        }>
        <View style={styles.titleRow}>
          <AppText variant="title">Partners</AppText>
          <Link href="/add-partner" asChild>
            <Pressable hitSlop={12} accessibilityLabel="Add partner">
              <SymbolView name="person.badge.plus" size={26} tintColor={Colors.flame} />
            </Pressable>
          </Link>
        </View>

        {incoming.map((p) => (
          <IncomingRequest key={p.partnership_id} partner={p} />
        ))}

        {partners.isSuccess && accepted.length === 0 && incoming.length === 0 && (
          <Card style={styles.empty}>
            <AppText variant="title" style={{ fontSize: 22, textAlign: 'center' }}>
              Better together 🤝
            </AppText>
            <AppText variant="body" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
              Add an accountability partner. You’ll see each other’s workouts and streaks, verify
              each other’s evidence, and compete in a weekly league.
            </AppText>
            <Link href="/add-partner" asChild>
              <Button title="Add a partner" />
            </Link>
          </Card>
        )}

        {accepted.length > 0 && league.data && <LeagueCard rows={league.data} />}

        {accepted.map((p) => (
          <PartnerCard key={p.partnership_id} partner={p} />
        ))}

        {outgoing.length > 0 && (
          <Card>
            <AppText variant="label">Waiting for them to accept</AppText>
            {outgoing.map((p) => (
              <View key={p.partnership_id} style={styles.pendingRow}>
                <Avatar id={p.partner_id} name={p.display_name} size={32} />
                <AppText variant="body" style={{ flex: 1 }}>
                  {p.display_name ?? 'Someone'}
                </AppText>
                <AppText variant="caption">Pending</AppText>
              </View>
            ))}
          </Card>
        )}

        {accepted.length > 0 && (
          <>
            <AppText variant="label" style={{ marginTop: Spacing.sm }}>
              Partner activity
            </AppText>
            {feed.data?.length ? (
              feed.data.map((item) => (
                <FeedCard key={item.workout.id} item={item} name={nameOf(item.workout.user_id)} />
              ))
            ) : (
              <AppText variant="caption">No partner workouts yet.</AppText>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function IncomingRequest({ partner }: { partner: Partner }) {
  const respond = useRespondToPartner();
  const answer = (accept: boolean) =>
    respond.mutate(
      { id: partner.partnership_id, accept },
      { onError: (e) => Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e)) },
    );
  return (
    <Card style={{ borderColor: Colors.flame }}>
      <View style={styles.pendingRow}>
        <Avatar id={partner.partner_id} name={partner.display_name} size={40} />
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{partner.display_name ?? 'Someone'}</AppText>
          <AppText variant="caption">wants to be your accountability partner</AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <Button title="Decline" variant="secondary" style={{ flex: 1 }} disabled={respond.isPending} onPress={() => answer(false)} />
        <Button title="Accept" style={{ flex: 1 }} loading={respond.isPending} onPress={() => answer(true)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { alignItems: 'stretch', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
});
