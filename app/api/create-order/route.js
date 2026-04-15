import Razorpay from "razorpay";

export async function POST(request) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return Response.json(
        { error: "Razorpay keys are not configured on server." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const amount = Number(body?.amount);
    const currency = body?.currency || "INR";

    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "Invalid amount provided." }, { status: 400 });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt: `receipt_${Date.now()}`,
    });

    return Response.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (error) {
    return Response.json(
      { error: "Unable to create order. Please try again." },
      { status: 500 }
    );
  }
}