import AuthPage from "./AuthPage";
export default function SetupPage({ onSuccess }: { onSuccess: () => void }) {
  return <AuthPage mode="setup" onSuccess={onSuccess} />;
}
