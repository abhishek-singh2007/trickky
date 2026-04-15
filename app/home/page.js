"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import Image from "next/image";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const DEMO_EVENT_ID = "demo-event-001";

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [events, setEvents] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketQrCode, setTicketQrCode] = useState("");
  const [paymentLoadingId, setPaymentLoadingId] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthLoading(false);
        setEventsLoading(false);
        router.replace("/");
        return;
      }

      setCurrentUser(user);
      setUserName(user.displayName || user.email || "User");
      setAuthLoading(false);

      try {
        setErrorMessage("");
        await ensureDemoEvent();
        const list = await loadEvents();
        setEvents(list);
      } catch (error) {
        setErrorMessage("We could not load events right now. Please refresh and try again.");
      } finally {
        setEventsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function ensureDemoEvent() {
    await setDoc(
      doc(db, "events", DEMO_EVENT_ID),
      {
        title: "Demo Event",
        price: 10,
        currency: "INR",
        isDemo: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function loadEvents() {
    const eventsQuery = query(collection(db, "events"), limit(10));
    const snapshot = await getDocs(eventsQuery);

    return snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        title: data.title || "Untitled Event",
        price: data.price ?? 0,
        currency: data.currency || "INR",
      };
    });
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      setErrorMessage("Logout failed. Please try again.");
    }
  }

  async function handleBuyTicket(eventItem) {
    setErrorMessage("");
    setTicketMessage("");
    setTicketQrCode("");
    setPaymentLoadingId(eventItem.id);

    try {
      if (!window.Razorpay) {
        throw new Error("Payment SDK failed to load.");
      }

      const orderResponse = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: eventItem.price,
          currency: eventItem.currency,
        }),
      });

      const orderData = await orderResponse.json();
      if (!orderResponse.ok) {
        throw new Error(orderData.error || "Could not start payment.");
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Ticket System",
        description: `Ticket for ${eventItem.title}`,
        order_id: orderData.orderId,
        prefill: {
          name: currentUser?.displayName || "",
          email: currentUser?.email || "",
        },
        theme: {
          color: "#0f6fff",
        },
        handler: async function (paymentResult) {
          try {
            const verifyResponse = await fetch("/api/verify-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ...paymentResult,
                userEmail: currentUser?.email || "",
                eventTitle: eventItem.title,
              }),
            });

            const verifyData = await verifyResponse.json();
            if (!verifyResponse.ok || !verifyData.success) {
              throw new Error(verifyData.error || "Payment verification failed.");
            }

            await addDoc(collection(db, "tickets"), {
              ticketId: verifyData.ticketId,
              userId: currentUser?.uid || "",
              userEmail: currentUser?.email || "",
              eventId: eventItem.id,
              eventTitle: eventItem.title,
              amount: eventItem.price,
              currency: eventItem.currency,
              orderId: verifyData.orderId,
              paymentId: verifyData.paymentId,
              qrCodeDataUrl: verifyData.qrCodeDataUrl || "",
              isUsed: false,
              createdAt: serverTimestamp(),
            });

            setTicketQrCode(verifyData.qrCodeDataUrl || "");

            setTicketMessage(
              `Payment successful! Your ticket ID is ${verifyData.ticketId}. Please take a screenshot.`
            );
          } catch (error) {
            setErrorMessage(error.message || "Payment succeeded but ticket creation failed.");
          } finally {
            setPaymentLoadingId("");
          }
        },
        modal: {
          ondismiss: function () {
            setPaymentLoadingId("");
            setErrorMessage("Payment was cancelled.");
          },
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (error) {
      setErrorMessage(error.message || "Unable to continue payment.");
      setPaymentLoadingId("");
    }
  }

  if (authLoading || eventsLoading) {
    return (
      <div className="page-wrap">
        <main className="profile-card">
          <h1>Loading...</h1>
          <p className="muted-text">Please wait while we prepare your dashboard.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

      <main className="profile-card">
        <div className="home-topbar">
          <div>
            <h1>Welcome, {userName}</h1>
            <p className="muted-text">You are logged in successfully.</p>
          </div>
          <button className="btn btn-google logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>

        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
        {ticketMessage ? <p className="success-box">{ticketMessage}</p> : null}
        {ticketQrCode ? (
          <div className="ticket-qr-box">
            <p>Ticket QR</p>
            <Image
              src={ticketQrCode}
              alt="Ticket QR Code"
              className="ticket-qr-image"
              width={220}
              height={220}
              unoptimized
            />
          </div>
        ) : null}

        <section>
          <h2 className="section-title">Available Events</h2>
          {events.length === 0 ? (
            <p className="muted-text">No events available yet.</p>
          ) : (
            <div className="event-list">
              {events.map((event) => (
                <article key={event.id} className="event-card">
                  <h3>{event.title}</h3>
                  <p>
                    Price: {event.currency} {event.price}
                  </p>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => handleBuyTicket(event)}
                    disabled={paymentLoadingId === event.id}
                  >
                    {paymentLoadingId === event.id ? "Opening payment..." : `Pay ${event.currency} ${event.price}`}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}