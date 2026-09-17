export type OrderEmailPayload = {
  customerName: string;
  orderNumber: string;
  status: string;
  totalAmount?: string;
  actionUrl?: string;
  trackingUrl?: string;
  supportEmail?: string;
  websiteUrl?: string;
};

/** Simple reusable HTML email shell for FurkanSoğutma transactional mail. */
export function renderOrderEmailHtml(payload: OrderEmailPayload): string {
  const action = payload.actionUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(payload.actionUrl)}" style="background:#0f2744;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;display:inline-block">Siparişi Görüntüle</a></p>`
    : '';
  const tracking = payload.trackingUrl
    ? `<p><a href="${escapeHtml(payload.trackingUrl)}">Kargoyu Takip Et</a></p>`
    : '';
  const total = payload.totalAmount
    ? `<tr><td style="padding:4px 0;color:#64748b">Tutar</td><td style="padding:4px 0;text-align:right;font-weight:600">${escapeHtml(payload.totalAmount)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"/><title>FurkanSoğutma</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:8px;overflow:hidden">
        <tr><td style="background:#0f2744;color:#fff;padding:20px 28px;font-size:20px;font-weight:700">FurkanSoğutma</td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 12px">Merhaba ${escapeHtml(payload.customerName || 'Müşterimiz')},</p>
          <p style="margin:0 0 20px;color:#475569">Siparişinizle ilgili bir güncelleme var.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px">
            <tr><td style="padding:4px 0;color:#64748b">Sipariş No</td><td style="padding:4px 0;text-align:right;font-weight:600">${escapeHtml(payload.orderNumber)}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b">Durum</td><td style="padding:4px 0;text-align:right;font-weight:600">${escapeHtml(payload.status)}</td></tr>
            ${total}
          </table>
          ${tracking}
          ${action}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5">
          <p style="margin:0">İletişim: ${escapeHtml(payload.supportEmail || 'destek@furkansogutma.com')}</p>
          <p style="margin:4px 0 0">${escapeHtml(payload.websiteUrl || 'https://furkansogutma.com')}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
