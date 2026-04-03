import { StartLogin } from "../../bindings/fastslack/slackauthservice";
import styles from "./Login.module.css";

export default function Login() {
  const handleLogin = () => {
    StartLogin();
  };

  return (
    <div class={styles.layout}>
      <div class={styles.content}>
        <h1>Slack login</h1>
        <button class="btn btn--primary" onClick={handleLogin}>
          Log in
        </button>
      </div>
      <div class={styles.sidebar} />
    </div>
  );
}
