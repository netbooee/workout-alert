// Which group chat is on screen, so a push for it doesn't also pop a banner
// while you're reading it. No native imports.

let open: string | null = null;

export function setOpenChat(groupId: string | null) {
  open = groupId;
}

/** True when a push is for the chat you're looking at. */
export function isOpenChatPush(data: { kind?: unknown; url?: unknown } | undefined): boolean {
  return !!open && data?.kind === 'group_chat' && data.url === `/group/chat/${open}`;
}
