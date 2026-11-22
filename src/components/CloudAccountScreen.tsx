import { useState, type FormEvent } from "react";
import { useCloudAccount } from "../hooks/useCloudAccount";

export default function CloudAccountScreen() {
  const { initializationError, signIn, signUp } = useCloudAccount();
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    try {
      if (creatingAccount) {
        const needsConfirmation = await signUp(email.trim(), password);
        setMessage(needsConfirmation
          ? "Account created. Confirm your email, then sign in."
          : "Account created and signed in.");
      } else {
        await signIn(email.trim(), password);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not authenticate with Supabase");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="cloud-auth-page">
      <section className="cloud-auth-card">
        <div className="cloud-auth-brand">
          <span className="cloud-auth-mark">A</span>
          <div>
            <b>AirWatch Cloud</b>
            <small>Private sensor dashboard</small>
          </div>
        </div>
        <h1>{creatingAccount ? "Create your account" : "Sign in to AirWatch"}</h1>
        <p>Sign in on both the APK and website to sync your device readings privately.</p>
        {(initializationError || error) && (
          <p className="cloud-auth-error" role="alert">{error || initializationError}</p>
        )}
        {message && <p className="cloud-auth-message" role="status">{message}</p>}
        <form className="cloud-auth-form" onSubmit={(event) => void submit(event)}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={creatingAccount ? "new-password" : "current-password"}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="cloud-auth-submit" type="submit" disabled={pending}>
            {pending ? "Please wait…" : creatingAccount ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
          className="cloud-auth-toggle"
          type="button"
          onClick={() => {
            setCreatingAccount((current) => !current);
            setMessage("");
            setError("");
          }}
        >
          {creatingAccount ? "Already have an account? Sign in" : "New to AirWatch? Create an account"}
        </button>
        <a className="cloud-apk-download" href="/downloads/airwatch.apk" download>
          Download the Android APK
        </a>
        <small className="cloud-auth-footnote">
          Your readings are private to the account that uploaded them.
        </small>
      </section>
    </main>
  );
}
