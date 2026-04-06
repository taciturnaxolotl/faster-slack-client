import styles from "./SlackChip.module.css";

function SlackChip() {
  return (
    <div class={styles.slackChip}>
      <img src="/slack.png" alt="slackicon" class={styles.slackIcon} />
    </div>
  );
}

export default SlackChip;
