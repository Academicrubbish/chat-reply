import AuthPage from "./AuthPage";
export default function SignUpPage({
  onSuccess,
  onSwitchToLogin,
}: {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}) {
  return (
    <AuthPage mode="signup" onSuccess={onSuccess} onSwitch={onSwitchToLogin} />
  );
}
