import { createEffect, createSignal, For, on, Show } from "solid-js";
import styles from "./MessageList.module.css";
import { Message, UserProfile, Emoji } from "../../bindings/fastslack/shared";
import {
  GetMessages,
  ResolveUsers,
  ResolveEmojis,
} from "../../bindings/fastslack/slackservice";
import MessageItem from "./MessageItem";
import { chatStore, setChatStore, scrollPositions } from "../ChatStore";

export default function MessageList(props: {
  teamID: string;
  channelID: string;
}) {
  let containerRef!: HTMLDivElement;
  let switchingChannel = false;
  const [loading, setLoading] = createSignal(false);
  const [fetchingOlder, setFetchingOlder] = createSignal(false);
  const [profiles, setProfiles] = createSignal<Record<string, UserProfile>>({});
  const [emojis, setEmojis] = createSignal<Record<string, Emoji>>({});

  const messages = () => chatStore.messages;

  const fetchProfilesAndEmojis = async (msgs: Message[]) => {
    const userIDs = new Set(msgs.map((m) => m.user));
    const emojiNames = new Set<string>();
    
    // Also find mentioned users and emojis in text
    for (const msg of msgs) {
      if (msg.text) {
        const userRegex = /<@(U[A-Z0-9]+|W[A-Z0-9]+)(?:\|[^>]+)?>/g;
        let match;
        while ((match = userRegex.exec(msg.text)) !== null) {
          userIDs.add(match[1]);
        }

        const emojiRegex = /:([a-zA-Z0-9_\-+]+):/g;
        while ((match = emojiRegex.exec(msg.text)) !== null) {
          emojiNames.add(match[1]);
        }
      }
    }

    const resolved = await ResolveUsers(props.teamID, Array.from(userIDs));
    const profileMap: Record<string, UserProfile> = {};
    for (const p of resolved) profileMap[p.id] = p;
    setProfiles((prev) => ({ ...prev, ...profileMap }));

    if (emojiNames.size > 0) {
      const resolvedEmojis = await ResolveEmojis(props.teamID, Array.from(emojiNames));
      const emojiMap: Record<string, Emoji> = {};
      for (const e of resolvedEmojis) emojiMap[e.name] = e;
      setEmojis((prev) => ({ ...prev, ...emojiMap }));
    }
  };

  const loadMessages = async (id: string) => {
    setLoading(true);
    setChatStore({ messages: [], nextCursor: null });
    const res = await GetMessages(props.teamID, id, "");
    if (res) {
      setChatStore({
        messages: [...res.messages],
        nextCursor: res.next_cursor || null,
      });
      fetchProfilesAndEmojis(res.messages);
    }
    setLoading(false);
  };

  const loadOlderMessages = async () => {
    const cursor = chatStore.nextCursor;
    if (!cursor || fetchingOlder()) return;

    setFetchingOlder(true);
    try {
      const res = await GetMessages(props.teamID, props.channelID, cursor);

      if (res) {
        setChatStore({
          messages: [...messages(), ...res.messages],
          nextCursor: res.next_cursor || null,
        });

        fetchProfilesAndEmojis(res.messages);
      }
    } finally {
      setFetchingOlder(false);
    }
  };

  createEffect(
    on(
      () => props.channelID,
      (id, prevID) => {
        if (prevID) {
          scrollPositions.set(prevID, containerRef.scrollTop);
        }
        switchingChannel = true;
        loadMessages(id).then(() => {
          requestAnimationFrame(() => {
            containerRef.scrollTop = scrollPositions.get(id) ?? 0;
            switchingChannel = false;
          });
        });
      },
    ),
  );

  const handleScroll = (e: Event) => {
    if (switchingChannel) return;
    const el = e.currentTarget as HTMLDivElement;

    scrollPositions.set(props.channelID, el.scrollTop);

    const atVisualTop = el.scrollHeight - el.clientHeight + el.scrollTop <= 5;
    if (atVisualTop && !fetchingOlder()) {
      loadOlderMessages();
    }
  };

  return (
    <div class={styles.list} ref={containerRef} onScroll={handleScroll}>
      <Show when={loading()}>
        <div class={styles.loading}>Loading history...</div>
      </Show>

      <For each={messages()}>
        {(msg, i) => {
          const next = () => messages()[i() + 1];
          const showHeader = () =>
            i() === messages().length - 1 || next()?.user !== msg.user;
          return (
            <MessageItem
              message={msg}
              profile={profiles()[msg.user]}
              allProfiles={profiles()}
              emojis={emojis()}
              showUser={showHeader()}
              workspaceID={props.teamID}
            />
          );
        }}
      </For>

      <Show when={fetchingOlder()}>
        <div class={styles.loading}>Fetching older messages...</div>
      </Show>
    </div>
  );
}
