import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

export function buildCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const head = headers.map(escapeCsv).join(',');
  const body = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  return `${head}\n${body}`;
}

export async function exportCsv(filenameBase: string, csv: string): Promise<void> {
  const filename = `${filenameBase.replace(/[^a-z0-9-_]+/gi, '_')}.csv`;
  console.log('[Reports] exportCsv', filename, csv.length, 'bytes');
  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.log('[Reports] web export error', e);
      throw e;
    }
    return;
  }
  try {
    await Share.share({ title: filename, message: csv });
  } catch (e) {
    console.log('[Reports] share error', e);
    throw e;
  }
}

export async function exportPdf(filenameBase: string, html: string): Promise<void> {
  console.log('[Reports] exportPdf', filenameBase);
  if (Platform.OS === 'web') {
    try {
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 400);
      }
    } catch (e) {
      console.log('[Reports] web pdf error', e);
      throw e;
    }
    return;
  }
  try {
    const { uri } = await Print.printToFileAsync({ html });
    console.log('[Reports] pdf saved', uri);
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
        dialogTitle: filenameBase,
      });
    } else {
      await Share.share({ url: uri, title: filenameBase });
    }
  } catch (e) {
    console.log('[Reports] native pdf error', e);
    throw e;
  }
}

export function wrapReportHtml(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color:#111827; padding:24px; background:#fff; }
    h1 { font-size:22px; margin:0 0 4px; color:#0F2E1A; letter-spacing:-0.3px; }
    h2 { font-size:14px; color:#4ADE80; text-transform:uppercase; letter-spacing:1px; margin:24px 0 8px; }
    .meta { color:#6B7280; font-size:12px; margin-bottom:12px; }
    table { width:100%; border-collapse:collapse; margin-top:6px; font-size:12px; }
    th, td { text-align:left; padding:8px 10px; border-bottom:1px solid #E5E7EB; }
    th { background:#F3F4F6; color:#374151; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.5px; }
    tr:nth-child(even) td { background:#FAFAFA; }
    .summary { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0; }
    .chip { padding:8px 12px; border-radius:10px; background:#ECFDF5; color:#065F46; font-weight:600; font-size:12px; border:1px solid #A7F3D0; }
    .empty { padding:20px; background:#F9FAFB; border-radius:8px; text-align:center; color:#6B7280; font-size:12px; }
    footer { margin-top:32px; color:#9CA3AF; font-size:10px; text-align:center; }
  </style>
</head>
<body>
  ${bodyHtml}
  <footer>VineWatch Report · Generated ${new Date().toLocaleString()}</footer>
</body>
</html>`;
}

export function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function htmlTable(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  if (rows.length === 0) {
    return `<div class="empty">No records</div>`;
  }
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map(
      (r) =>
        `<tr>${r
          .map((c) => `<td>${escapeHtml(c == null ? '—' : String(c))}</td>`)
          .join('')}</tr>`
    )
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
