import { db } from "@/db";
import { miningUpgrades, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Seeding mining boost plans...");

  const upgrades = [
    {
      name: "Starter Boost",
      description: "Increase your daily mining output to 1.5 KRY",
      priceUsdt: "2.00",
      miningRate: "0.0625", // 1.5 / 24
      durationDays: "30",
    },
    {
      name: "Turbo Boost",
      description: "Supercharge your mining to 3.0 KRY per day",
      priceUsdt: "4.00",
      miningRate: "0.125", // 3.0 / 24
      durationDays: "30",
    },
  ];

  for (const up of upgrades) {
    await db
      .insert(miningUpgrades)
      .values(up)
      .onConflictDoUpdate({
        target: miningUpgrades.name,
        set: up,
      });
  }

  console.log("Seeding puzzle tasks...");

  const puzzleTasks = [
    {
      title: "Daily Crypto Puzzle #1",
      description: "Solve this puzzle to earn KRY tokens!",
      type: "puzzle",
      rewardAmount: "5.0",
      puzzleData: JSON.stringify({
        question: "Which consensus mechanism does Ethereum currently use?",
        options: ["Proof of Work", "Proof of Stake", "Proof of History", "Proof of Burn"],
      }),
      correctAnswer: "Proof of Stake",
    },
    {
      title: "Daily Crypto Puzzle #2",
      description: "What is the maximum supply of Bitcoin?",
      type: "puzzle",
      rewardAmount: "5.0",
      puzzleData: JSON.stringify({
        question: "What is the maximum supply of Bitcoin?",
        options: ["18 Million", "21 Million", "42 Million", "Unlimited"],
      }),
      correctAnswer: "21 Million",
    },
    {
      title: "Follow us on X (Twitter)",
      description: "Stay updated with our latest news and earn rewards!",
      type: "social",
      rewardAmount: "10.0",
      taskLink: "https://x.com/krypton_obsidian",
    },
    {
      title: "Join our Telegram Group",
      description: "Connect with the community and earn rewards!",
      type: "social",
      rewardAmount: "10.0",
      taskLink: "https://t.me/krypton_obsidian",
    },
    {
      title: "Watch Intro Video",
      description: "Learn how Krypton works and get a secret code at the end!",
      type: "video",
      rewardAmount: "20.0",
      taskLink: "https://youtube.com/watch?v=example",
      completionCode: "KRYPTON_GOLD",
    },
  ];

  for (const t of puzzleTasks) {
    await db
      .insert(tasks)
      .values(t)
      .onConflictDoUpdate({
        target: tasks.title,
        set: t,
      });
  }

  console.log("Mining seed complete!");
}

main().catch(console.error);
