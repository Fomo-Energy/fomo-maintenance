"use client";

import { useEffect, useState } from "react";

export default function ManageAccessBootstrap() {
  const [message, setMessage] = useState(
    "Open the secure link from your booking confirmation email.",
  );

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    const token = parameters.get("access");
    if (!token) {
      return;
    }

    window.history.replaceState(null, "", `${window.location.pathname}`);
    setMessage("Verifying your secure booking link…");

    void fetch("/api/manage/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      if (response.ok) {
        window.location.reload();
        return;
      }
      setMessage("This booking link is invalid, expired, or has been replaced.");
    }).catch(() => {
      setMessage("The booking link could not be verified. Please try again.");
    });
  }, []);

  return <p role="status">{message}</p>;
}
