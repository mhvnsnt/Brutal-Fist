import { createFileRoute } from "@tanstack/react-router";
import { AuthProvider as GameAuthProvider } from "@/contexts/AuthContext";
import App from "@/App";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <GameAuthProvider>
      <App />
    </GameAuthProvider>
  );
}
