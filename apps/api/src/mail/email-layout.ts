export interface EmailContent {
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footer?: string;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** Renders a transactional email as HTML and plain text. All input is escaped. */
export function renderEmail(content: EmailContent): { html: string; text: string } {
  const paragraphs = content.paragraphs
    .map((p) => `<p style="font-size:15px;line-height:22px;margin:0 0 16px;">${escapeHtml(p)}</p>`)
    .join('');
  const action = content.action
    ? `<p style="margin:8px 0 24px;"><a href="${escapeHtml(content.action.url)}" style="display:inline-block;background:#e50914;color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;padding:12px 24px;">${escapeHtml(content.action.label)}</a></p>`
    : '';
  const footer = content.footer
    ? `<p style="font-size:13px;line-height:20px;color:#616e7c;margin:0;">${escapeHtml(content.footer)}</p>`
    : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>My Movie Catalog</title></head><body style="margin:0;padding:32px 16px;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2933;"><div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;"><div style="font-size:20px;font-weight:700;color:#e50914;margin-bottom:24px;">🎬 My Movie Catalog</div><h1 style="font-size:22px;margin:0 0 16px;">${escapeHtml(content.heading)}</h1>${paragraphs}${action}${footer}</div></body></html>`;
  const text = [
    content.heading,
    '',
    ...content.paragraphs,
    ...(content.action ? ['', `${content.action.label}: ${content.action.url}`] : []),
    ...(content.footer ? ['', content.footer] : []),
  ].join('\n');
  return { html, text };
}
