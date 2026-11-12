import { Link, router } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText, Button, Card } from "@/components/ui";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useMyChats } from "@/hooks/use-chat";
import { chatTime, previewLine } from "@/lib/chat";
import type { ChatSummary } from "@/lib/database.types";

export default function ChatsScreen() {
  const chats = useMyChats();
  const list = chats.data ?? [];

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={chats.isRefetching}
            tintColor={Colors.flame}
            onRefresh={() => chats.refetch()}
          />
        }
      >
        <AppText variant="title">Chats</AppText>

        {chats.isSuccess && list.length === 0 && (
          <Card style={styles.empty}>
            <AppText
              variant="title"
              style={{ fontSize: 22, textAlign: "center" }}
            >
              Chat with your crew 💬
            </AppText>
            <AppText
              variant="body"
              color={Colors.textSecondary}
              style={{ textAlign: "center" }}
            >
              Every group gets its own chat. Start one with family, friends or
              coworkers, or join with a code.
            </AppText>
            <Link href="/group/new" asChild>
              <Button title="Start a group" />
            </Link>
          </Card>
        )}

        {list.length > 0 && (
          <Card style={styles.list}>
            {list.map((c, i) => (
              <ChatListRow
                key={c.group_id}
                chat={c}
                last={i === list.length - 1}
              />
            ))}
          </Card>
        )}

        {list.length > 0 && (
          <AppText variant="caption" style={styles.note}>
            Weekly goals and squad wins show up in your group chats too, so
            there’s always something to cheer.
          </AppText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChatListRow({ chat: c, last }: { chat: ChatSummary; last: boolean }) {
  const unread = c.unread > 0;
  const preview = previewLine(c);
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/group/chat/[id]",
          params: { id: c.group_id },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`${c.name}. ${preview}.${unread ? ` ${c.unread} new.` : ""}${c.muted ? " Muted." : ""}`}
      style={({ pressed }) => [
        styles.row,
        !last && styles.divider,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.emoji}>
        <AppText style={{ fontSize: 24 }}>{c.emoji}</AppText>
      </View>
      <View style={styles.body}>
        <View style={styles.line}>
          <AppText
            variant="heading"
            numberOfLines={1}
            style={{ flex: 1, fontWeight: unread ? "800" : "600" }}
          >
            {c.name}
          </AppText>
          {c.last_at && (
            <AppText
              variant="caption"
              color={unread && !c.muted ? Colors.flame : Colors.textSecondary}
              style={{ fontSize: 12, fontWeight: unread ? "700" : "400" }}
            >
              {chatTime(new Date(c.last_at))}
            </AppText>
          )}
        </View>
        <View style={styles.line}>
          <AppText
            variant="body"
            numberOfLines={1}
            color={unread ? Colors.text : Colors.textSecondary}
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: unread ? "600" : "400",
            }}
          >
            {preview}
          </AppText>
          {c.muted && (
            <SymbolView
              name="bell.slash.fill"
              size={14}
              tintColor={Colors.textMuted}
            />
          )}
          {unread && (
            <View
              style={[
                styles.count,
                c.muted && { backgroundColor: Colors.cardRaised },
              ]}
            >
              <AppText
                style={styles.countText}
                color={c.muted ? Colors.textSecondary : "#000"}
              >
                {c.unread > 99 ? "99+" : c.unread}
              </AppText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xl * 2,
  },
  empty: { alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.lg },
  list: { paddingVertical: 2, paddingHorizontal: Spacing.sm + 4 },
  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm + 4,
    paddingVertical: Spacing.sm,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  emoji: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.flameSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  count: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.flame,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 12, fontWeight: "800" },
  note: { marginHorizontal: Spacing.xs },
});
