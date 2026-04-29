import Pusher from "pusher";

if (!process.env.PUSHER_APP_ID || !process.env.PUSHER_KEY || !process.env.PUSHER_SECRET || !process.env.PUSHER_CLUSTER) {
  console.warn("Pusher environment variables are missing. Real-time updates will be disabled.");
}

export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "app-id",
  key: process.env.PUSHER_KEY || "key",
  secret: process.env.PUSHER_SECRET || "secret",
  cluster: process.env.PUSHER_CLUSTER || "mt1",
  useTLS: true,
});

export const triggerTradeUpdate = async (tradeId: string, event: string, data: any) => {
  try {
    await pusher.trigger(`trade-${tradeId}`, event, data);
  } catch (error) {
    console.error("Pusher trigger failed:", error);
  }
};
