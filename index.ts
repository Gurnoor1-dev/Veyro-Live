import {
  AttachmentBuilder,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Message,
  type TextBasedChannel,
} from "discord.js";
import { readFile, writeFile } from "node:fs/promises";
import {
  createCountdownImage,
  getCountdownParts,
  TARGET_TIMESTAMP,
  TARGET_LABEL,
} from "./countdown";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const STATE_FILE = new URL("./countdown-state.json", import.meta.url);
const UPDATE_INTERVAL_MS = 60_000;
const IMAGE_NAME = "veyro-countdown.png";

if (!TOKEN) {
  throw new Error("Missing DISCORD_BOT_TOKEN. Add it to your host's private secrets.");
}

type CountdownState = {
  channelId: string;
  messageId: string;
  startedAt: string;
};

let countdownMessage: Message | null = null;
let updateTimer: ReturnType<typeof setInterval> | null = null;
let updateInProgress = false;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const countdownCommand = new SlashCommandBuilder()
  .setName("countdown")
  .setDescription("Launch the VEYRO LIVE countdown in this channel.");

async function loadState(): Promise<CountdownState | null> {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    const state = JSON.parse(raw) as CountdownState;
    if (!state.channelId || !state.messageId) return null;
    return state;
  } catch {
    return null;
  }
}

async function saveState(state: CountdownState): Promise<void> {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

async function clearState(): Promise<void> {
  try {
    await writeFile(STATE_FILE, "", "utf8");
  } catch (error) {
    console.error("Could not clear countdown state:", error);
  }
}

function makeEmbed() {
  const parts = getCountdownParts();
  const embed = new EmbedBuilder()
    .setColor(parts.complete ? 0x63d6bd : 0x398dff)
    .setImage(`attachment://${IMAGE_NAME}`)
    .setFooter({ text: parts.complete ? "VEYRO LIVE • THE MOMENT IS HERE" : "VEYRO LIVE • AUTO-REFRESHES EVERY MINUTE" });

  if (parts.complete) {
    embed.setTitle("The countdown is complete");
    embed.setDescription(`The target time — **${TARGET_LABEL}** — has arrived.`);
  } else {
    embed.setTitle("A moment worth counting down to");
    embed.setDescription(`**Target:** ${TARGET_LABEL}\n**Format:** DD  HH  MM  SS`);
  }

  return embed;
}

async function updateCountdownMessage(message: Message): Promise<boolean> {
  const image = await createCountdownImage();
  await message.edit({
    embeds: [makeEmbed()],
    files: [new AttachmentBuilder(image, { name: IMAGE_NAME })],
    attachments: [],
    allowedMentions: { parse: [] },
  });

  return getCountdownParts().complete;
}

function startMinuteUpdates(message: Message): void {
  if (updateTimer) clearInterval(updateTimer);

  const tick = async () => {
    if (updateInProgress) return;
    updateInProgress = true;

    try {
      const complete = await updateCountdownMessage(message);
      if (complete && updateTimer) {
        clearInterval(updateTimer);
        updateTimer = null;
        console.log("Countdown completed. Automatic updates stopped.");
      }
    } catch (error) {
      console.error("Countdown image update failed:", error);
    } finally {
      updateInProgress = false;
    }
  };

  // Align updates to minute boundaries so the seconds display stays meaningful.
  const delay = UPDATE_INTERVAL_MS - (Date.now() % UPDATE_INTERVAL_MS);
  setTimeout(() => {
    void tick();
    updateTimer = setInterval(() => void tick(), UPDATE_INTERVAL_MS);
  }, delay);
}

async function getExistingMessage(): Promise<Message | null> {
  const state = await loadState();
  if (!state) return null;

  try {
    const channel = await client.channels.fetch(state.channelId);
    if (!channel?.isTextBased() || !("messages" in channel)) return null;
    return await channel.messages.fetch(state.messageId);
  } catch {
    return null;
  }
}

async function launchCountdown(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (countdownMessage) {
    await interaction.editReply({
      content: `The single VEYRO countdown is already running: ${countdownMessage.url}`,
    });
    return;
  }

  const existing = await getExistingMessage();
  if (existing) {
    countdownMessage = existing;
    startMinuteUpdates(existing);
    await interaction.editReply({
      content: `The VEYRO countdown is already running: ${existing.url}`,
    });
    return;
  }

  if (!interaction.channel || !interaction.channel.isTextBased() || !("send" in interaction.channel)) {
    await interaction.editReply("Please run /countdown in a text channel where the bot can send messages.");
    return;
  }

  if (Date.now() >= TARGET_TIMESTAMP) {
    await interaction.editReply("The configured countdown target has already passed.");
    return;
  }

  const image = await createCountdownImage();
  const message = await interaction.channel.send({
    embeds: [makeEmbed()],
    files: [new AttachmentBuilder(image, { name: IMAGE_NAME })],
    allowedMentions: { parse: [] },
  });

  countdownMessage = message;
  await saveState({
    channelId: message.channelId,
    messageId: message.id,
    startedAt: new Date().toISOString(),
  });
  startMinuteUpdates(message);

  await interaction.editReply(`Countdown launched. This single message will refresh every minute: ${message.url}`);
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(readyClient.user.id), {
    body: [countdownCommand.toJSON()],
  });
  console.log("Registered the single /countdown command.");

  const existing = await getExistingMessage();
  if (existing) {
    countdownMessage = existing;
    if (getCountdownParts().complete) {
      try {
        await updateCountdownMessage(existing);
      } catch (error) {
        console.error("Could not publish the completed countdown image:", error);
      }
    } else {
      startMinuteUpdates(existing);
      console.log("Restored the existing countdown message.");
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "countdown") return;

  try {
    await launchCountdown(interaction);
  } catch (error) {
    console.error("Could not launch countdown:", error);
    const message = "I couldn't start the countdown. Check that I have View Channel, Send Messages, Embed Links and Attach Files permissions.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(() => undefined);
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
    }
  }
});

client.on(Events.Error, (error) => {
  console.error("Discord client error:", error);
});

process.on("SIGINT", () => {
  if (updateTimer) clearInterval(updateTimer);
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (updateTimer) clearInterval(updateTimer);
  client.destroy();
  process.exit(0);
});

await client.login(TOKEN);
