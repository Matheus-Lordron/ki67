// Envio do código 2FA (RF-02).
//
// As Edge Functions não podem abrir conexões nas portas SMTP 25 e 587, então o
// e-mail sai por API HTTP. Implementado com o Resend (https://resend.com), que
// tem plano gratuito. Para trocar de provedor, mude só esta função.
//
// Sem RESEND_API_KEY e com DEV_LOG_2FA_CODE=true, o código aparece apenas no
// log da função (Supabase > Edge Functions > Logs). Use isso só em desenvolvimento.

import { HttpError } from './http.ts';

export async function sendTwoFactorEmail(to: string, name: string, code: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM') ?? 'Segmenta Studio Ki-67 <onboarding@resend.dev>';
  const subject = `Seu código de acesso: ${code}`;
  const text = `Olá, ${name}.\n\nSeu código de verificação do Segmenta Studio Ki-67 é ${code}.\nEle vale por 10 minutos e só pode ser usado uma vez.\n\nSe não foi você que tentou entrar, ignore este e-mail e avise o administrador do estudo.`;

  if (!apiKey) {
    if (Deno.env.get('DEV_LOG_2FA_CODE') === 'true') {
      console.log(`[DEV] código 2FA de ${to}: ${code}`);
      return;
    }
    throw new HttpError(500, 'Envio de e-mail não configurado (RESEND_API_KEY).');
  }

  const html = `<div style="font-family:Inter,Arial,sans-serif;color:#0b1c30;max-width:480px">
    <h2 style="color:#00236f">Segmenta Studio · Ki-67 IHC</h2>
    <p>Olá, ${name.replace(/[<>&]/g, '')}.</p>
    <p>Seu código de verificação é:</p>
    <p style="font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;letter-spacing:6px;color:#00236f">${code}</p>
    <p style="color:#444651;font-size:13px">Vale por 10 minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail e avise o administrador do estudo.</p>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    console.error('Resend recusou o envio', res.status, await res.text());
    throw new HttpError(502, 'Não foi possível enviar o código por e-mail.');
  }
}
