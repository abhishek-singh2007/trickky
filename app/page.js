"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { getAuthErrorMessage } from "@/lib/auth-errors";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/home");
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function saveUserData(user) {
    await setDoc(
      doc(db, "users", user.uid),
      {
        uid: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        photoURL: user.photoURL || "",
        lastLoginAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function handleEmailLogin(event) {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await saveUserData(result.user);
      router.push("/home");
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setErrorMessage("");
    setIsLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      await saveUserData(result.user);
      router.push("/home");
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="page-wrap">
      <main className="auth-card">
        <h1>Event Ticketing Login</h1>
        <p className="muted-text">Sign in to browse events and manage your tickets.</p>

        <form className="auth-form" onSubmit={handleEmailLogin}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button type="submit" className="btn btn-primary">
            {isLoading ? "Please wait..." : "Login"}
          </button>
        </form>

        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

        <div className="divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="btn btn-google"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        >
          Continue with Google
        </button>

        <div className="link-row">
          <span>Routing demo:</span>
          <Link href="/profile/demo-user-001">View sample profile</Link>
        </div>
      </main>
    </div>
  );
}
