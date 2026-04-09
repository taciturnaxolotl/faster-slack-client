import { Show } from "solid-js";
import type {
  Message,
  UserProfile,
  Emoji,
} from "../../bindings/fastslack/shared/models";
import { parseSlackMarkdown } from "../utils/markdown";
import { formatMessageTime } from "../utils/time";
import styles from "./MessageItem.module.css";
import ClankerChip from "./misc/ClankerChip";
import ThreadRepliesButton from "./misc/ThreadRepliesButton";

export default function MessageItem(props: {
  message: Message;
  profile?: UserProfile;
  allProfiles?: Record<string, UserProfile>;
  emojis?: Record<string, Emoji>;
  showUser?: boolean;
  workspaceID: string;
}) {
  const getAvatarUrl = (profile: UserProfile) => {
    const hash = profile.profile.avatar_hash;
    const userId = profile.id;
    const workspaceID = props.workspaceID;

    return `https://ca.slack-edge.com/${workspaceID}-${userId}-${hash}-48`;
  };

  return (
    <div class={`${styles.message} ${props.showUser ? styles.groupStart : ""}`}>
      <div class={styles.left}>
        <Show when={props.showUser && props.profile}>
          <img
            src={getAvatarUrl(props.profile!)}
            alt={`${props.profile!.profile.display_name}'s profile picture`}
            class={styles.avatar}
          />
        </Show>
      </div>
      <div class={styles.right}>
        <Show when={props.showUser && props.profile}>
          <div class={styles.header}>
            <span class={styles.username}>
              {props.profile!.profile.display_name ||
                props.profile!.profile.real_name}
            </span>
            <div class={styles.timestamp}>
              {formatMessageTime(props.message.ts)}
            </div>
            <Show when={props.profile?.is_bot}>
              <ClankerChip />
            </Show>
          </div>
        </Show>
        <div class={styles.text}>{parseSlackMarkdown(props.message.text, props.allProfiles, props.emojis)}</div>
        <Show when={props.message.reply_count && props.message.reply_count > 0}>
          <ThreadRepliesButton
            message={props.message}
            workspaceID={props.workspaceID}
            onClick={() => {}}
          />
        </Show>
      </div>
    </div>
  );
}
