export function getAuthErrorMessage(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/missing-password":
      return "Password is required.";
    case "auth/invalid-credential":
      return "Email or password is incorrect.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/popup-closed-by-user":
      return "Google sign-in popup was closed before completion.";
    case "auth/popup-blocked":
      return "Popup was blocked by your browser. Please allow popups and try again.";
    case "auth/cancelled-popup-request":
      return "Another sign-in request is already in progress.";
    case "auth/network-request-failed":
      return "Network issue detected. Please check your internet and try again.";
    default:
      return "Something went wrong while signing in. Please try again.";
  }
}