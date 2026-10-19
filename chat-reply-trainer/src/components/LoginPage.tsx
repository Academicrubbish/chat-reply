import AuthPage from "./AuthPage";
export default function LoginPage({
  onSuccess,
  onSwitchToSignUp,
}: {
  onSuccess: () => void;
  onSwitchToSignUp: () => void;
}) {
  return (
    <AuthPage mode="login" onSuccess={onSuccess} onSwitch={onSwitchToSignUp} />
  );
}
