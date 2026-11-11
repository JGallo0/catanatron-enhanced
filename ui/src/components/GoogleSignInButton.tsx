import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
          }) => void;
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

export default function GoogleSignInButton({
  clientId,
  onCredential,
}: {
  clientId: string;
  onCredential: (credential: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    setLoadFailed(false);
    let cancelled = false;

    const renderGsi = () => {
      if (cancelled) return;
      const api = window.google?.accounts?.id;
      const el = containerRef.current;
      if (!api || !el) {
        setLoadFailed(true);
        return;
      }
      setLoadFailed(false);
      el.innerHTML = "";
      const measuredWidth = Math.min(320, Math.max(220, el.clientWidth || 280));
      api.initialize({
        client_id: clientId,
        callback: (resp) => {
          if (resp?.credential) onCredentialRef.current(resp.credential);
        },
      });
      api.renderButton(el, {
        theme: "filled_black",
        size: "large",
        text: "signin_with",
        shape: "pill",
        locale: "pt_BR",
        width: measuredWidth,
      });
    };

    const handleScriptError = () => {
      if (!cancelled) setLoadFailed(true);
    };

    if (window.google?.accounts?.id) {
      renderGsi();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SCRIPT_SRC}"]`
    );
    if (existing) {
      if (existing.dataset.gsiStatus === "error") {
        setLoadFailed(true);
        return;
      }
      existing.addEventListener("load", renderGsi);
      existing.addEventListener("error", handleScriptError);
      return () => {
        cancelled = true;
        existing.removeEventListener("load", renderGsi);
        existing.removeEventListener("error", handleScriptError);
      };
    }

    const script = document.createElement("script");
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.gsiStatus = "loaded";
      renderGsi();
    };
    script.onerror = () => {
      script.dataset.gsiStatus = "error";
      handleScriptError();
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loadFailed) {
    return (
      <div className="home-auth-google-error" role="status">
        Não foi possível carregar o script do Google neste navegador. Use usuário e senha acima ou libere{" "}
        <code>accounts.google.com</code>.
      </div>
    );
  }

  return <div ref={containerRef} className="google-signin-slot" />;
}
