# Admin Overview — Frontend Implementation Guide

This guide details how to consume the `GET /api/admin/overview` endpoint to populate the Admin Dashboard.

## Endpoint Details
- **URL**: `/api/admin/overview`
- **Method**: `GET`
- **Auth**: Required (`Authorization: Bearer <token>`)

---

## TypeScript Interfaces

Use these interfaces to ensure type safety in your frontend components.

```typescript
export interface OverviewResponse {
  overview: {
    // Stat Cards
    totalUsers: number;
    totalUsersChange: number; // Percentage (e.g. 8.2)
    activeUsers: number;
    activeUsersChange: number;
    totalTrades: number;
    totalTradesChange: number;
    tradeVolume: string; // Fiat amount as string
    tradeVolumeChange: number;

    // Backward compatibility / extra stats
    completedTransactions: number;
    feesCollected: string;
    pendingTransactions: number;

    // Network Growth Chart
    networkGrowth: {
      data: Array<{
        date: string; // YYYY-MM-DD
        newUsers: number;
        volume: number;
      }>;
      peakVolume: number;
    };

    // Volume Distribution
    volumeDistribution: Array<{
      pair: string; // e.g. "BTC/NGN" or "OTHERS"
      percentage: number;
      tradeCount: number;
    }>;

    // System Status
    systemStatus: {
      status: "operational" | "degraded" | "down";
      tps: number;
      latencyMs: number;
    };

    // Latest Trades Table
    latestTrades: Array<{
      id: string;
      pair: string;
      price: string;
      amount: string; // Crypto amount
      fiatAmount: string;
      status: "pending" | "payment_sent" | "payment_confirmed" | "completed" | "cancelled" | "disputed";
      timestamp: string;
    }>;

    // Latest Signups Panel
    latestSignups: Array<{
      id: string;
      name: string;
      email: string;
      kycStatus: string; // e.g. "KYC LEVEL 2", "KYC PENDING"
      joinedAt: string;
    }>;
  };
}
```

---

## UI Component Mapping

### 1. Top Stat Cards
| UI Element | API Path | Formatting Tip |
| :--- | :--- | :--- |
| **Total Users** | `totalUsers` | Use `Intl.NumberFormat` (e.g. 12,400) |
| **User Trend** | `totalUsersChange` | If > 0, show green `+`. If < 0, show red. |
| **Active Users** | `activeUsers` | |
| **Total Trades** | `totalTrades` | |
| **Total Volume** | `tradeVolume` | Prefix with currency symbol (₦) |

### 2. Network Growth Chart
- **X-Axis**: `networkGrowth.data[].date`
- **Lines**: Plot `newUsers` and `volume` on a dual-axis chart if possible.
- **Peak Annotation**: Use `networkGrowth.peakVolume` for the "Peak Peak" badge.

### 3. Volume Distribution
- Use `volumeDistribution` array to populate the progress bars.
- `pair` maps to the label (BTC/USDT).
- `percentage` maps to the bar width.

### 4. System Status
- **Status Indicator**: If `systemStatus.status === 'operational'`, show green dot.
- **TPS**: Display `systemStatus.tps`.
- **Latency**: Display `${systemStatus.latencyMs}ms`.

### 5. Tables & Lists
- **Latest Trades**: Iterate `latestTrades`. Map the `status` to your CSS color utility (e.g., `completed` -> `bg-green-500/10`).
- **Latest Signups**: Iterate `latestSignups`. Use `joinedAt` with a library like `date-fns` to get "2 mins ago".

---

## Sample Response

```json
{
  "overview": {
    "totalUsers": 12450,
    "totalUsersChange": 8.2,
    "activeUsers": 5210,
    "activeUsersChange": 12.5,
    "totalTrades": 85000,
    "totalTradesChange": -2.1,
    "tradeVolume": "1200000000.00",
    "tradeVolumeChange": 24.8,
    "networkGrowth": {
      "data": [
        { "date": "2024-04-24", "newUsers": 150, "volume": 45000000 },
        { "date": "2024-04-25", "newUsers": 180, "volume": 52000000 }
      ],
      "peakVolume": 52000000
    },
    "systemStatus": {
      "status": "operational",
      "tps": 1402,
      "latencyMs": 42
    },
    "latestTrades": [
      {
        "pair": "BTC/NGN",
        "price": "64231.50",
        "amount": "0.452",
        "status": "completed",
        "timestamp": "2024-04-30T12:45:00Z"
      }
    ]
  }
}
```
