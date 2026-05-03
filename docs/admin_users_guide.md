# Admin Users Management — Frontend Implementation Guide

This guide details how to consume the users-related endpoints to populate the Users section of the Admin Dashboard.

## Endpoints

### 1. List Users
- **URL**: `/api/admin/users`
- **Method**: `GET`
- **Query Parameters**:
  - `search` (optional): Search by email or username.
  - `kycStatus` (optional): Filter by `unverified`, `pending`, `approved`, or `failed`.
  - `isAdmin` (optional): Filter by `true` or `false`.
  - `page` (optional): Page number (default: 1).
  - `limit` (optional): Items per page (default: 20, max: 100).

### 2. User Details
- **URL**: `/api/admin/users/{id}`
- **Method**: `GET`
- **Parameters**:
  - `id`: The UUID of the user.

---

## TypeScript Interfaces

```typescript
export interface UserListResponse {
  users: Array<{
    id: string;
    email: string;
    username: string | null;
    isEmailVerified: boolean;
    isTwoFactorEnabled: boolean;
    isAdmin: boolean;
    createdAt: string;
    lastSeenAt: string | null;
    profile: {
      fullName: string | null;
      kycLevel: string;
      kycStatus: string;
      avatarUrl: string | null;
    };
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UserDetailsResponse {
  user: {
    id: string;
    email: string;
    username: string | null;
    phone: string | null;
    isEmailVerified: boolean;
    isTwoFactorEnabled: boolean;
    isAdmin: boolean;
    createdAt: string;
    updatedAt: string;
    profile: {
      userId: string;
      fullName: string | null;
      avatarUrl: string | null;
      dateOfBirth: string | null;
      country: string | null;
      kycLevel: string;
      kycStatus: string;
      preferredCurrency: string;
    };
    wallets: Array<{
      id: string;
      balance: string;
      frozenBalance: string;
      depositAddress: string | null;
      asset: {
        symbol: string;
        name: string;
        iconUrl: string | null;
      };
    }>;
    transactions: Array<{
      id: string;
      type: string;
      amount: string;
      fee: string;
      fiatAmount: string;
      fiatCurrency: string;
      status: string;
      reference: string | null;
      createdAt: string;
      asset: {
        symbol: string;
      };
    }>;
  };
}
```

---

## Implementation Tips

### Users Table
- **Search**: Use a debounce on the search input to call `/api/admin/users?search=<value>`.
- **KYC Status Badge**: 
  - `approved` -> Green
  - `pending` -> Yellow/Orange
  - `failed` -> Red
  - `unverified` -> Gray
- **Last Seen**: Use `lastSeenAt` with `formatDistanceToNow` (date-fns) to show "Last seen 2 hours ago". If `null`, show "Never".

### User Details Modal/Page
- **Balances**: Map the `wallets` array to show balances for each asset (USDT, BTC, etc.).
- **Transaction History**: Use the `transactions` array to show a mini-feed of the user's latest activity.
- **Admin Actions**: These endpoints are read-only for now. Future updates will include `PATCH` endpoints for suspending users or manual KYC overrides.

---

## Sample List Request
`GET /api/admin/users?kycStatus=pending&limit=10`
