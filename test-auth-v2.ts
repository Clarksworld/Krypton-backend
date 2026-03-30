import "dotenv/config";

async function main() {
  const email = `auth-v2-${Date.now()}@example.com`;
  const password = "password123";
  const username = `auth_v2_${Date.now()}`;

  console.log(`--- Testing Auth Security Enhancements for ${email} ---`);

  // 1. Register User (Unverified by default)
  console.log("1. Registering user...");
  const regRes = await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, username }),
    headers: { "Content-Type": "application/json" },
  });
  const regData = await regRes.json();
  console.log("Registration Response:", regData.message);

  // 2. Try Login (Should fail)
  console.log("2. Attempting login before verification...");
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: { "Content-Type": "application/json" },
  });
  const loginData = await loginRes.json();
  console.log("Login Response (Expected 401):", loginRes.status, loginData.error);

  // 3. Resend Verification
  console.log("3. Testing resend verification...");
  const resendRes = await fetch("http://localhost:3000/api/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
    headers: { "Content-Type": "application/json" },
  });
  const resendData = await resendRes.json();
  console.log("Resend Response:", resendData.message);

  // 4. Test Password Forgot (Check for 6-digit OTP in logs manually)
  console.log("4. Testing forgot password (OTP generation)...");
  const forgotRes = await fetch("http://localhost:3000/api/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
    headers: { "Content-Type": "application/json" },
  });
  const forgotData = await forgotRes.json();
  console.log("Forgot Password Response:", forgotData.message);
  console.log("ACTION REQUIRED: Check terminal logs for the 6-digit OTP.");
}

main();
