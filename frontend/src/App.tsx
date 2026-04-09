import { Navigate, Route, Router } from "@solidjs/router";
import { Show, type ParentProps } from "solid-js";
import { useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Home from "./pages/Home";

function AuthGuard(props: ParentProps) {
  const { authed } = useAuth();
  return (
    <Show when={authed()} fallback={<Navigate href="/login" />}>
      {props.children}
    </Show>
  );
}

console.log("Current User-Agent:", navigator.userAgent);

function App() {
  const { ready } = useAuth();
  return (
    <Show when={ready()}>
      <Router>
        <Route path="/login" component={Login} />
        <Route path="/" component={AuthGuard}>
          <Route path="/" component={Home} />
        </Route>
      </Router>
    </Show>
  );
}

export default App;
