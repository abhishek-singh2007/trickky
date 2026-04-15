import crypto from "crypto";
import nodemailer from "nodemailer";
import QRCode from "qrcode";

function createTicketId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `TKT-${timestamp}-${random}`;
}

async function sendTicketEmail({ userEmail, ticketId, eventTitle, qrCodeDataUrl }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const qrBase64 = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");
  const qrCid = `ticket-qr-${ticketId}@trickky`;

  await transporter.sendMail({
    from,
    to: userEmail,
    subject: "Your Ticket Confirmation",
    text: `Payment successful! Your ticket ID is ${ticketId} for ${eventTitle}.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #182230;">
        <h2 style="margin-bottom: 8px;">Your Ticket is Confirmed</h2>
        <p style="margin: 0 0 12px;">Payment successful for <strong>${eventTitle}</strong>.</p>
        <p style="margin: 0 0 12px;">Ticket ID: <strong>${ticketId}</strong></p>
        <p style="margin: 0 0 8px;">Show this QR at entry:</p>
        <img src="cid:${qrCid}" alt="Ticket QR" width="220" height="220" />
      </div>
    `,
    attachments: [
      {
        filename: `${ticketId}.png`,
        content: qrBase64,
        encoding: "base64",
        contentType: "image/png",
        cid: qrCid,
      },
    ],
  });

  return true;
}

export async function POST(request) {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return Response.json(
        { error: "Razorpay key secret is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userEmail,
      eventTitle,
    } = body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return Response.json({ error: "Incomplete payment details." }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return Response.json(
        { error: "Payment verification failed. Signature mismatch." },
        { status: 400 }
      );
    }

    const ticketId = createTicketId();
    const qrPayload = {
      ticketId,
      eventTitle: eventTitle || "your event",
      paymentId: razorpay_payment_id,
      issuedAt: new Date().toISOString(),
    };
    const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload));

    let emailSent = false;
    if (userEmail) {
      try {
        emailSent = await sendTicketEmail({
          userEmail,
          ticketId,
          eventTitle: eventTitle || "your event",
          qrCodeDataUrl,
        });
      } catch (error) {
        emailSent = false;
      }
    }

    return Response.json({
      success: true,
      ticketId,
      emailSent,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      qrCodeDataUrl,
    });
  } catch (error) {
    return Response.json(
      { error: "Could not verify payment. Please contact support." },
      { status: 500 }
    );
  }
}