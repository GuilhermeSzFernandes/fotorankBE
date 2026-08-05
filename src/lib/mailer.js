// Envio de e-mail via API HTTP da Brevo (HTTPS/443).
// Usamos a API REST em vez de SMTP porque hosts como o Render (plano free)
// bloqueiam a saída nas portas SMTP (25/465/587). HTTPS não é bloqueado.

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const FROM_NAME_DEFAULT = 'FotoRank';
const REQUEST_TIMEOUT_MS = 15000;

// Resolve o remetente { name, email }.
// Prefere EMAIL_FROM/EMAIL_FROM_NAME; se ausentes, tenta extrair de SMTP_FROM
// nos formatos "Nome <email>" ou apenas "email".
function resolveSender() {
  if (process.env.EMAIL_FROM) {
    return { name: process.env.EMAIL_FROM_NAME || FROM_NAME_DEFAULT, email: process.env.EMAIL_FROM.trim() };
  }
  const raw = (process.env.SMTP_FROM || '').trim();
  const match = raw.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim() || FROM_NAME_DEFAULT, email: match[2].trim() };
  if (raw) return { name: FROM_NAME_DEFAULT, email: raw };
  return null;
}

async function sendPasswordResetEmail(email, resetUrl) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY não configurada.');
  }
  const sender = resolveSender();
  if (!sender) {
    throw new Error('Remetente não configurado. Defina EMAIL_FROM (ou SMTP_FROM).');
  }

  const textContent = [
    'Você solicitou a redefinição da sua senha no FotoRank.',
    '',
    'Acesse o link abaixo para criar uma nova senha:',
    resetUrl,
    '',
    'Este link é válido por 1 hora.',
    'Se você não solicitou a recuperação, ignore este e-mail.',
  ].join('\n');

  const htmlContent = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
    <h1 style="font-size:20px;margin:0 0 16px">Recuperação de senha</h1>
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px">
      Você solicitou a redefinição da sua senha no <strong>FotoRank</strong>.
      Clique no botão abaixo para criar uma nova senha:
    </p>
    <p style="margin:0 0 20px">
      <a href="${resetUrl}"
         style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:4px;font-size:14px">
        Redefinir senha
      </a>
    </p>
    <p style="font-size:12px;line-height:1.6;color:#666;margin:0 0 8px">
      Ou copie e cole este endereço no navegador:<br>
      <a href="${resetUrl}" style="color:#666;word-break:break-all">${resetUrl}</a>
    </p>
    <p style="font-size:12px;line-height:1.6;color:#666;margin:16px 0 0">
      Este link é válido por 1 hora. Se você não solicitou a recuperação, ignore este e-mail.
    </p>
  </div>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [{ email }],
        subject: 'Recuperação de senha — FotoRank',
        htmlContent,
        textContent,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'tempo limite excedido' : err.message;
    throw new Error(`Falha de rede ao chamar a API da Brevo: ${reason}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API respondeu ${res.status}: ${body}`);
  }
}

module.exports = { sendPasswordResetEmail };
