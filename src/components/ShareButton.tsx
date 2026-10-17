"use client";

import { useState } from "react";

/** The board URL *is* the invitation: anyone with the link can join. */
export function ShareButton() {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Clipboard API unavailable (http, permissions): let the user copy it.
      window.prompt("Copy this link to share the board:", window.location.href);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button type="button" className="topbar-button" data-testid="share" onClick={share}>
      {copied ? "Link copied!" : "Share"}
    </button>
  );
}
