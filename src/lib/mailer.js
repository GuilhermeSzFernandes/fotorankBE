const nodemailer = require('nodemailer');

let cachedTransport = null;

// Cria (e reaproveita) o transporter SMTP a partir das variáveis de ambiente.
// Lança erro se o SMTP não estiver configurado — o envio de e-mail é obrigatório.
function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      'SMTP não configurado. Defina SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS.'
    );
  }
  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true', // true para porta 465, false para 587/STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return cachedTransport;
}

async function sendPasswordResetEmail(email, resetUrl) {
  const transport = getTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const text = [
    'Você solicitou a redefinição da sua senha no FotoRank.',
    '',
    'Acesse o link abaixo para criar uma nova senha:',
    resetUrl,
    '',
    'Este link é válido por 1 hora.',
    'Se você não solicitou a recuperação, ignore este e-mail.',
  ].join('\n');

  const html = `
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

  await transport.sendMail({
    from,
    to: email,
    subject: 'Recuperação de senha — FotoRank',
    text,
    html,
  });
}

module.exports = { sendPasswordResetEmail };
