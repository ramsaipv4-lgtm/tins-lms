// AC-165: issue certificates (core certificateId on the server), download a PDF with a QR code, export the ids.
import { useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { Msg, errText, useLoad } from './common.tsx';
import { Pdf, csv, download } from './pdf.ts';

interface Data {
  org: any; enabled: boolean;
  learners: { personId: string; name: string; programId: string; programName: string }[];
  issued: { certId: string; personId: string; name: string; programId: string; programName: string; issuedAt: number }[];
}

export default function Certificates() {
  const d = useLoad<Data>('/api/admin/certificates');
  const [error, setError] = useState<string | null>(null);
  const data = d.data;

  async function issue(personId: string, programId: string) {
    setError(null);
    try { await api('/api/admin/certificates', { body: { personId, programId } }); d.reload(); } catch (e) { setError(errText(e)); }
  }
  function pdf(c: Data['issued'][number]) {
    const url = `${location.origin}/verify/${c.certId}`;
    const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    const modules = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, k) => !!qr.modules.get(r, k)));
    const p = new Pdf(data!.org, t('admin.certs.pdfTitle'), c.programName);
    p.line(t('admin.certs.pdfBody', { name: c.name, program: c.programName }), 14);
    p.gap(); p.line(t('admin.certs.pdfId', { id: c.certId }), 12, true);
    p.line(t('admin.certs.pdfDate', { date: new Date(c.issuedAt).toISOString().slice(0, 10) }));
    p.gap(); p.line(t('admin.certs.pdfVerify', { url }), 10);
    p.qr(modules, 48, p.y - 150, 140);
    download(`certificate-${c.certId}.pdf`, p.build(), 'application/pdf');
  }
  function sheet() {
    download('certificate-ids.csv', csv([[t('admin.certs.col.id'), t('admin.certs.col.name'), t('admin.certs.col.program'), t('admin.certs.col.date')],
      ...data!.issued.map((c) => [c.certId, c.name, c.programName, new Date(c.issuedAt).toISOString().slice(0, 10)])]), 'text/csv');
  }

  return (
    <section aria-labelledby="cert-h">
      <h1 id="cert-h">{t('admin.certs.title')}</h1>
      <Msg error={error || d.error} />
      {data && !data.enabled && <p role="status">{t('admin.certs.off')}</p>}
      {data && data.enabled && (
        <>
          <table>
            <caption>{t('admin.certs.learners')}</caption>
            <thead><tr><th scope="col">{t('admin.certs.col.name')}</th><th scope="col">{t('admin.certs.col.action')}</th></tr></thead>
            <tbody>
              {data.learners.filter((l) => !data.issued.some((c) => c.personId === l.personId && c.programId === l.programId)).map((l) => (
                <tr key={l.personId + l.programId}>
                  <td translate="no">{l.name}</td>
                  <td><button type="button" onClick={() => void issue(l.personId, l.programId)}>{t('admin.certs.issue')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2>{t('admin.certs.issued')}</h2>
          {data.issued.length === 0 ? <p>{t('admin.certs.none')}</p> : (
            <ul>
              {data.issued.map((c) => (
                <li key={c.certId} style={{ margin: '8px 0' }}>
                  <span translate="no">{c.name}</span>: <span data-testid="certificate-id" translate="no">{c.certId}</span>{' '}
                  <button type="button" onClick={() => pdf(c)}>{t('admin.certs.download')}</button>
                </li>
              ))}
            </ul>
          )}
          {data.issued.length > 0 && <button type="button" onClick={sheet}>{t('admin.certs.sheet')}</button>}
        </>
      )}
    </section>
  );
}
