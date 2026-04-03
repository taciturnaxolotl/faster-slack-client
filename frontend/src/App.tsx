import { Navigate, Route, Router } from "@solidjs/router";
import { useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Home from "./pages/Home";
import type { ParentProps } from "solid-js";

function AuthGuard(props: ParentProps) {
  const { authed } = useAuth();
  if (!authed()) return <Navigate href="/login" />;
  return <>{props.children}</>;
}

console.log("Current User-Agent:", navigator.userAgent);

function App() {
  return (
    <Router>
      <Route path="/login" component={Login} />
      <Route path="/" component={AuthGuard}>
        <Route path="/" component={Home} />
      </Route>
    </Router>
  );
}

export default App;
