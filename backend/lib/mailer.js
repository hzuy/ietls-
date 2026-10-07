'use strict'
const nodemailer = require('nodemailer')

let transporter = null

function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function getTransporter() {
  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT) || 587
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
  }
  return transporter
}

async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP chưa được cấu hình')
    if (process.env.NODE_ENV !== 'test') console.log(`[mailer] SMTP chưa cấu hình, bỏ qua gửi mail tới ${to}: ${subject}\n${text}`)
    return { skipped: true }
  }
  const from = process.env.MAIL_FROM || `IELTS Pro <${process.env.SMTP_USER}>`
  await getTransporter().sendMail({ from, to, subject, text, html })
  return { skipped: false }
}

function resetTransporter() {
  transporter = null
}

module.exports = { sendMail, isMailConfigured, resetTransporter }
