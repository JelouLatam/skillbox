import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "./api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import type { JevProvider } from "../shared";

const names: Record<JevProvider, string> = {
  vercel: "Vercel AI Gateway",
  typesafe: "TypeSafe AI",
};
type Status = { provider: JevProvider; configured: boolean };
export function GatewaySettings() {
  const [config, setConfig] = useState<Status | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/settings/ai-gateway")
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);
  const update = async (provider: JevProvider, key?: string | null) => {
    setBusy(true);
    setError("");
    setApiKey("");
    try {
      setConfig(
        await api("/settings/ai-gateway", {
          method: "PUT",
          body: JSON.stringify({
            provider,
            ...(key !== undefined ? { apiKey: key } : {}),
          }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const provider = config?.provider ?? "vercel";
  return (
    <section className="settings-card" aria-labelledby="gateway-heading">
      <header className="settings-card-header">
        <div className="settings-card-icon">
          <Sparkles size={18} />
        </div>
        <div className="settings-card-title">
          <h2 id="gateway-heading">Jev recommendations</h2>
          <p>
            Task-aware skill recommendations using your own AI provider key.
          </p>
        </div>
        <span
          role="status"
          className={`status-badge ${config?.configured ? "ok" : ""}`}
        >
          {!config
            ? "Loading…"
            : config.configured
              ? "Key saved"
              : "Not configured"}
        </span>
      </header>
      <div className="settings-card-body">
        <label>
          Provider
          <select
            value={provider}
            disabled={busy || !config}
            onChange={(e) => update(e.target.value as JevProvider)}
          >
            <option value="vercel">Vercel AI Gateway</option>
            <option value="typesafe">TypeSafe AI</option>
          </select>
          <small className="field-help">
            Tasks and authorized skill descriptions are sent to{" "}
            {names[provider]}; charges apply to your account. Keys are saved
            separately for each provider.
          </small>
        </label>
        <label>
          {names[provider]} API key
          <Input
            type="password"
            autoComplete="new-password"
            placeholder={config?.configured ? "••••••••••••" : "Paste your key"}
            value={apiKey}
            disabled={busy || !config}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <small className="field-help">
            {config?.configured
              ? "Stored encrypted. Paste a new key to replace it."
              : "Without a key, recommendations fall back to deterministic search."}
          </small>
        </label>
        {error && (
          <div className="error-note" role="alert">
            {error}
          </div>
        )}
      </div>
      <footer className="settings-card-footer">
        {config?.configured && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => update(provider, null)}
          >
            Remove key
          </Button>
        )}
        <Button
          disabled={busy || !config || !apiKey.trim()}
          onClick={() => update(provider, apiKey.trim())}
        >
          Save key
        </Button>
      </footer>
    </section>
  );
}
