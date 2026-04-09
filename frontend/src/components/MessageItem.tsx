import { Show } from "solid-js";
import type {
  Message,
  UserProfile,
} from "../../bindings/fastslack/shared/models";
import styles from "./MessageItem.module.css";

export default function MessageItem(props: {
  message: Message;
  profile?: UserProfile;
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
    <div class={styles.message}>
      <Show when={props.showUser && props.profile}>
        <div class={styles.nameCard}>
          <div class={styles.pfpContainer}>
            <img
              src={getAvatarUrl(props.profile!)}
              alt={`${props.profile!.profile.display_name}'s profile picture`}
              class={styles.avatar}
            />
          </div>
          <span class={styles.realName}>
            {props.profile!.profile.display_name ||
              props.profile!.profile.real_name}
          </span>
        </div>
      </Show>
      <span class={styles.text}>{props.message.text}</span>
    </div>
  );
}
