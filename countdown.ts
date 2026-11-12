import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";

import { readFile, writeFile } from "node:fs/promises";

const STATE_FILE = new URL("./countdown-state.json", import.meta.url);
const UPDATE_INTERVAL_MS = 60_000;
const IMAGE_NAME = "veyro-countdown.png";
type CountdownState = { channelId: string; messageId: string; guildId?: string };
let savedState: CountdownState | null = null;
let botToken = "";
let updateTimer: ReturnType<typeof setInterval> | null = null;
let updateInProgress = false;

function messageUrl(state: CountdownState) {
  return "https://discord.com/channels/" + (state.guildId ?? "@me") + "/" + state.channelId + "/" + state.messageId;
}

async function discordRequest(path: string, init: RequestInit = {}) {
  const response = await fetch("https://discord.com/api/v10" + path, {
    ...init,
    headers: { Authorization: "Bot " + botToken, ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error("Discord API request failed (" + response.status + "): " + await response.text());
  return response;
}

async function persistState(state: CountdownState | null) {
  savedState = state;
  if (state) {
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } else {
    try { await writeFile(STATE_FILE, "", "utf8"); } catch { /* no previous state */ }
  }
}

async function buildMessageForm(now = Date.now()) {
  const parts = getCountdownParts(now);
  const image = await createCountdownImage(now);
  const form = new FormData();
  form.append("payload_json", JSON.stringify({
    embeds: [{
      color: parts.complete ? 6543037 : 3777791,
      title: parts.complete ? "The countdown is complete" : "A moment worth counting down to",
      description: parts.complete
        ? "The target time — **" + TARGET_LABEL + "** — has arrived."
        : "**Target:** " + TARGET_LABEL + "\n**Format:** DD  HH  MM  SS",
      image: { url: "attachment://" + IMAGE_NAME },
      footer: { text: parts.complete ? "VEYRO LIVE • THE MOMENT IS HERE" : "VEYRO LIVE • AUTO-REFRESHES EVERY MINUTE" },
    }],
    attachments: [{ id: 0, filename: IMAGE_NAME }],
    allowed_mentions: { parse: [] },
  }));
  form.append("files[0]", new Blob([image], { type: "image/png" }), IMAGE_NAME);
  return form;
}

async function updateSavedMessage() {
  if (!savedState || !botToken || updateInProgress) return;
  updateInProgress = true;
  try {
    const form = await buildMessageForm();
    await discordRequest("/channels/" + savedState.channelId + "/messages/" + savedState.messageId, {
      method: "PATCH",
      body: form,
    });
    if (getCountdownParts().complete && updateTimer) {
      clearInterval(updateTimer);
      updateTimer = null;
      console.log("VEYRO countdown completed.");
    }
  } finally {
    updateInProgress = false;
  }
}

function beginUpdates() {
  if (updateTimer) clearInterval(updateTimer);
  if (getCountdownParts().complete) {
    void updateSavedMessage().catch((error) => console.error("Final countdown update failed:", error));
    return;
  }
  updateTimer = setInterval(() => {
    void updateSavedMessage().catch((error) => console.error("Countdown refresh failed:", error));
  }, UPDATE_INTERVAL_MS);
}

export async function startCountdownService(token: string) {
  botToken = token;
  if (!botToken) return;
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as CountdownState;
    if (parsed.channelId && parsed.messageId) {
      await discordRequest("/channels/" + parsed.channelId + "/messages/" + parsed.messageId);
      savedState = parsed;
      beginUpdates();
      console.log("Restored the existing VEYRO countdown message.");
    }
  } catch {
    // No saved countdown yet, or the previous Discord message no longer exists.
  }
}

export async function launchCountdown(channelId: string, token: string): Promise<string> {
  botToken = token;
  if (!botToken) throw new Error("The Discord bot token is not configured.");
  if (savedState) {
    try {
      await discordRequest("/channels/" + savedState.channelId + "/messages/" + savedState.messageId);
      return messageUrl(savedState);
    } catch {
      await persistState(null);
    }
  }
  if (getCountdownParts().complete) throw new Error("The configured countdown target has already passed.");
  const form = await buildMessageForm();
  const response = await discordRequest("/channels/" + channelId + "/messages", { method: "POST", body: form });
  const message = await response.json() as { id: string; channel_id: string; guild_id?: string };
  const state = { channelId: message.channel_id, messageId: message.id, guildId: message.guild_id };
  await persistState(state);
  beginUpdates();
  return messageUrl(state);
}


export const TARGET_TIMESTAMP = Date.UTC(2026, 10, 13, 0, 0, 0);
export const TARGET_LABEL = "13 NOVEMBER 2026  ·  00:00 UTC";

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  complete: boolean;
};

export function getCountdownParts(now = Date.now()): CountdownParts {
  const remaining = Math.max(0, TARGET_TIMESTAMP - now);
  const totalSeconds = Math.floor(remaining / 1_000);

  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    complete: now >= TARGET_TIMESTAMP,
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

function roundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawBackground(ctx: SKRSContext2D, width: number, height: number) {
  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, "#07111f");
  base.addColorStop(0.48, "#0b1930");
  base.addColorStop(1, "#10132a");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(1190, 280, 10, 1190, 280, 680);
  glow.addColorStop(0, "rgba(35, 137, 255, 0.23)");
  glow.addColorStop(0.48, "rgba(34, 91, 190, 0.09)");
  glow.addColorStop(1, "rgba(34, 91, 190, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const violet = ctx.createRadialGradient(220, 820, 5, 220, 820, 520);
  violet.addColorStop(0, "rgba(116, 76, 255, 0.16)");
  violet.addColorStop(1, "rgba(116, 76, 255, 0)");
  ctx.fillStyle = violet;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = "rgba(151, 184, 229, 0.055)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  // A restrained constellation texture gives the background depth without noise.
  for (let i = 0; i < 54; i++) {
    const x = (i * 197 + 83) % width;
    const y = (i * 113 + 47) % height;
    const radius = i % 7 === 0 ? 2.2 : 1.1;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = i % 5 === 0
      ? "rgba(115, 181, 255, 0.55)"
      : "rgba(205, 222, 255, 0.25)";
    ctx.fill();
  }
}

function drawPill(ctx: SKRSContext2D, x: number, y: number, label: string) {
  roundedRect(ctx, x, y, 208, 42, 21);
  ctx.fillStyle = "rgba(67, 143, 255, 0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(116, 177, 255, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = "#8fc4ff";
  ctx.font = "700 15px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 104, y + 21);
}

function drawTimeCard(
  ctx: SKRSContext2D,
  x: number,
  value: string,
  label: string,
  accent: string,
) {
  const y = 472;
  const width = 260;
  const height = 190;

  roundedRect(ctx, x, y, width, height, 22);
  const panel = ctx.createLinearGradient(x, y, x + width, y + height);
  panel.addColorStop(0, "rgba(21, 43, 72, 0.94)");
  panel.addColorStop(1, "rgba(11, 25, 46, 0.94)");
  ctx.fillStyle = panel;
  ctx.fill();
  ctx.strokeStyle = "rgba(153, 190, 235, 0.17)";
  ctx.lineWidth = 1.3;
  ctx.stroke();

  roundedRect(ctx, x + 22, y + 20, 3, 40, 2);
  ctx.fillStyle = accent;
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = accent;
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#f4f8ff";
  ctx.font = "700 76px Arial";
  ctx.fillText(value, x + width / 2, y + 111);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#91a8c7";
  ctx.font = "700 15px Arial";
  ctx.fillText(label, x + width / 2, y + 151);
}

function drawCompletion(ctx: SKRSContext2D) {
  ctx.textAlign = "center";
  ctx.shadowColor = "#64b5ff";
  ctx.shadowBlur = 34;
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 82px Arial";
  ctx.fillText("THE MOMENT IS HERE", 800, 550);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#a9c7ec";
  ctx.font = "400 25px Arial";
  ctx.fillText("The countdown has reached zero.", 800, 605);
}

export async function createCountdownImage(now = Date.now()): Promise<Buffer> {
  const width = 1600;
  const height = 900;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  drawBackground(ctx, width, height);

  // Outer frame and corner accents.
  roundedRect(ctx, 34, 34, width - 68, height - 68, 28);
  ctx.strokeStyle = "rgba(157, 194, 239, 0.22)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#eaf3ff";
  ctx.font = "700 19px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("VEYRO", 94, 105);
  ctx.fillStyle = "#75baff";
  ctx.fillText("  /  LIVE", 166, 105);

  ctx.textAlign = "right";
  ctx.fillStyle = "#8098b8";
  ctx.font = "600 14px Arial";
  ctx.fillText("A MOMENT WORTH COUNTING DOWN TO", 1505, 104);

  drawPill(ctx, 696, 177, getCountdownParts(now).complete ? "COUNTDOWN COMPLETE" : "THE COUNTDOWN IS ON");

  ctx.textAlign = "center";
  ctx.fillStyle = "#f5f8ff";
  ctx.font = "700 66px Arial";
  ctx.fillText(getCountdownParts(now).complete ? "It's time." : "Something is getting closer.", 800, 330);

  ctx.fillStyle = "#9bb0cd";
  ctx.font = "400 22px Arial";
  ctx.fillText(TARGET_LABEL, 800, 382);

  const parts = getCountdownParts(now);
  if (parts.complete) {
    drawCompletion(ctx);
  } else {
    const values = [pad(parts.days), pad(parts.hours), pad(parts.minutes), pad(parts.seconds)];
    const labels = ["DAYS", "HOURS", "MINUTES", "SECONDS"];
    const accents = ["#63b7ff", "#7c9dff", "#a28bff", "#69d7e8"];
    const startX = 240;
    const gap = 28;
    const cardWidth = 260;
    values.forEach((value, index) => {
      drawTimeCard(ctx, startX + index * (cardWidth + gap), value, labels[index], accents[index]);
    });
  }

  // Footer separator and live-status detail.
  const line = ctx.createLinearGradient(94, 0, 1506, 0);
  line.addColorStop(0, "rgba(108, 169, 255, 0)");
  line.addColorStop(0.5, "rgba(108, 169, 255, 0.38)");
  line.addColorStop(1, "rgba(108, 169, 255, 0)");
  ctx.fillStyle = line;
  ctx.fillRect(94, 733, 1412, 1);

  ctx.textAlign = "left";
  ctx.fillStyle = "#7189aa";
  ctx.font = "600 14px Arial";
  ctx.fillText("ONE DESTINATION. ONE MOMENT.", 96, 780);

  ctx.textAlign = "right";
  ctx.fillStyle = "#91a9c9";
  ctx.font = "500 14px Arial";
  ctx.fillText("13 NOV 2026  ·  00:00 GMT", 1504, 780);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(150, 174, 207, 0.55)";
  ctx.font = "400 12px Arial";
  ctx.fillText("VEYRO LIVE  •  COUNTDOWN SYSTEM", 800, 835);

  return canvas.toBuffer("image/png");
}
