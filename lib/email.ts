export interface TransactionalEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface EmailProviderConfig {
  apiKey?: string;
  from?: string;
}

type EmailSendResult =
  | { status: "sent"; id?: string }
  | { status: "not-configured" }
  | { status: "provider-error" };

interface ResendResponse {
  id?: unknown;
}

export async function sendEmail(
  config: EmailProviderConfig,
  message: TransactionalEmail,
  fetchImplementation: typeof fetch = fetch,
): Promise<EmailSendResult> {
  if (!config.apiKey?.trim() || !config.from?.trim()) {
    return { status: "not-configured" };
  }

  try {
    const response = await fetchImplementation("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!response.ok) return { status: "provider-error" };

    const data = await response.json().catch(() => ({})) as ResendResponse;
    return {
      status: "sent",
      ...(typeof data.id === "string" ? { id: data.id } : {}),
    };
  } catch {
    return { status: "provider-error" };
  }
}
