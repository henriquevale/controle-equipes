import nodemailer from 'nodemailer';

// Utilize a sua Conta do Google e uma Senha de App gerada nas configurações de segurança do Google
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'seu-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'sua-senha-de-app-do-gmail'
  }
});

export const enviarCodigo2FA = async (emailDestino, codigo) => {
  const mailOptions = {
    from: '"Sistema de Controlo" <seu-email@gmail.com>',
    to: emailDestino,
    subject: 'Seu Código de Segurança - Login',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Código de Verificação</h2>
        <p>Utilize o código abaixo para concluir a autenticação no sistema:</p>
        <h1 style="color: #2563eb; letter-spacing: 4px;">${codigo}</h1>
        <p>Este código expira em <strong>10 minutos</strong>.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};