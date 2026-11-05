const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

export interface MailpitMessage {
  ID: string;
  Subject: string;
  Text: string;
  HTML: string;
  To: { Address: string }[];
}

interface SearchResult {
  messages: { ID: string; Created: string }[];
}

/** Waits for the newest email to `to` (optionally created after `since`) and returns it. */
export async function waitForEmail(
  to: string,
  options: { since?: Date; subjectIncludes?: string; timeoutMs?: number } = {},
): Promise<MailpitMessage> {
  const deadline = Date.now() + (options.timeoutMs ?? 10_000);
  while (Date.now() < deadline) {
    const query = encodeURIComponent(`to:"${to}"`);
    const result = (await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`).then((r) =>
      r.json(),
    )) as SearchResult;
    for (const summary of result.messages ?? []) {
      if (options.since && new Date(summary.Created).getTime() < options.since.getTime() - 1000) {
        continue;
      }
      const message = (await fetch(`${MAILPIT_URL}/api/v1/message/${summary.ID}`).then((r) =>
        r.json(),
      )) as MailpitMessage;
      if (!options.subjectIncludes || message.Subject.includes(options.subjectIncludes)) {
        return message;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`No email to ${to} arrived in time`);
}

export function extractCode(message: MailpitMessage): string {
  const code = /\b(\d{6})\b/.exec(message.Text)?.[1];
  if (!code) throw new Error('No 6-digit code in email');
  return code;
}

export function extractTokenHash(message: MailpitMessage): string {
  const tokenHash = /token_hash=([A-Za-z0-9_-]+)/.exec(message.HTML)?.[1];
  if (!tokenHash) throw new Error('No magic link in email');
  return tokenHash;
}

export function extractLink(message: MailpitMessage, pathIncludes: string): string {
  const link = [...message.HTML.matchAll(/href="([^"]+)"/g)]
    .map((match) => match[1]!.replaceAll('&amp;', '&'))
    .find((href) => href.includes(pathIncludes));
  if (!link) throw new Error(`No link containing ${pathIncludes} in email`);
  return link;
}
