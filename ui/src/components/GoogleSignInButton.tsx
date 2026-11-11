import { useEffect, useRef } from "react";

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

export default function GoogleSignInButton({
  clientId,
  onCredential,
}: {
  clientId: string;
  onCredential: (credential: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!clientId) return;

    const renderGsi = () => {
      const api = window.google?.accounts?.id;
      if (!api || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      api.initialize({
        client_id: clientId,
        callback: (resp) => {
          if (resp?.credential) onCredential(resp.credential);
        },
      });
      api.renderButton(containerRef.current, {
        theme: "filled_black",
        size: "large",
        text: "signin_with",
        shape: "pill",
        locale: "pt_BR",
      });
    };

    if (window.google?.accounts?.id) {
      renderGsi();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", renderGsi);
      return () => existing.removeEventListener("load", renderGsi);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGsi;
    document.head.appendChild(script);
    return () => {
      script.onload = null;
    };
  }, [clientId, onCredential]);

  return <div ref={containerRef} className="google-signin-slot" />;
}
