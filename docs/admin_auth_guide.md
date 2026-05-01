# Admin Authentication Implementation Guide

This document outlines the steps for the frontend team to implement Admin Registration and Login.

## 1. Overview

The admin authentication flow is separate from the user authentication flow to ensure strict separation of concerns. Admins use a specific secret key for registration and are automatically assigned the `admin` role.

### Endpoints
- **Register**: `POST /api/admin/auth/register`
- **Login**: `POST /api/admin/auth/login`

---

## 2. Admin Registration

Use this flow for the initial setup of admin accounts.

### Request
- **URL**: `/api/admin/auth/register`
- **Method**: `POST`
- **Body**:
```json
{
  "email": "admin@krypton.com",
  "password": "securepassword123",
  "username": "superadmin",
  "adminSecret": "your_configured_admin_secret"
}
```

### Response (201 Created)
```json
{
  "status": "success",
  "data": {
    "token": "jwt_token_here",
    "message": "Admin account created successfully.",
    "user": {
      "id": "uuid",
      "email": "admin@krypton.com",
      "username": "superadmin",
      "isAdmin": true
    }
  }
}
```
*Note: The `krypton_token` cookie is also set automatically.*

---

## 3. Admin Login

Use this flow for subsequent access to the admin dashboard.

### Request
- **URL**: `/api/admin/auth/login`
- **Method**: `POST`
- **Body**:
```json
{
  "email": "admin@krypton.com",
  "password": "securepassword123"
}
```

### Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": "uuid",
      "email": "admin@krypton.com",
      "username": "superadmin",
      "isAdmin": true
    }
  }
}
```

---

## 4. Frontend Integration Steps

### Step 1: Secure the Admin Secret
Do not hardcode the `adminSecret` in the frontend source code. Use environment variables during the build process or provide a field in the registration UI for it.

### Step 2: Handle Authentication State
Upon successful login or registration:
1. Store the JWT token in `localStorage` or a secure state management tool (e.g., Redux/Zustand) if needed for non-cookie requests.
2. The browser will automatically handle the `krypton_token` HTTP-only cookie for all subsequent API calls.

### Step 3: Protected Routes
In the frontend router (e.g., React Router or Next.js Middleware):
- Verify the presence of the `isAdmin` flag in the user profile.
- Redirect non-admin users away from `/admin/*` routes.

### Step 4: Error Handling
- **401 Unauthorized**: Redirect to login page.
- **403 Forbidden**: Show "Access Denied" message (e.g., when a non-admin tries to use the admin login).
- **400 Bad Request**: Show validation errors (e.g., email already taken).

---

## 5. Security Recommendations
- Always use HTTPS in production.
- Ensure `ADMIN_REGISTRATION_SECRET` is complex and rotated periodically.
- Consider implementing 2FA for admin accounts (the backend supports it via the `twoFactorSecret` field in the user schema).
