import { createClient } from "@supabase/supabase-js";
import { launchCountdown, startCountdownService } from "./countdown";

type Interaction = {
  id: string;
  application_id: string;
  type: number;
  token: string;
  guild_id?: string;
  channel_id?: string;
  member?: { roles?: string[]; user?: { id?: string } };
  user?: { id?: string };
  message?: { id?: string };
  data?: { custom_id?: string; name?: string };
};

const env = {
  discordPublicKey: process.env.DISCORD_PUBLIC_KEY ?? "",
  discordBotToken: process.env.DISCORD_BOT_TOKEN ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
};

const missing = Object.entries(env)
  .filter(([, value]) => !value)
  .map(([key]) => key);

const supabase = env.supabaseUrl && env.serviceRoleKey
  ? createClient(env.supabaseUrl, env.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  return new Uint8Array(value.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)));
}

async function verifyDiscordSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(env.discordPublicKey)) return false;
  if (!/^[0-9a-f]{128}$/i.test(signature) || !/^\d{1,20}$/.test(timestamp)) return false;

  const keyBytes = hexToBytes(env.discordPublicKey);
  const signatureBytes = hexToBytes(signature);
  if (!keyBytes || !signatureBytes) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      signatureBytes,
      new TextEncoder().encode(timestamp + rawBody),
    );
  } catch {
    return false;
  }
}

async function editInteractionReply(interaction: Interaction, content: string) {
  const url = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  }).catch(() => undefined);
}

async function markDiscordMessageReviewed(
  channelId: string,
  messageId: string,
  content: string,
) {
  if (!env.discordBotToken) return;
  const components = [{
    type: 1,
    components: [
      { type: 2, style: 3, label: "Approve", custom_id: "reviewed:approve", disabled: true },
      { type: 2, style: 4, label: "Reject", custom_id: "reviewed:reject", disabled: true },
    ],
  }];
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${env.discordBotToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      components,
      allowed_mentions: { parse: [] },
    }),
  }).catch(() => undefined);
}

async function processDecision(interaction: Interaction, action: "approve" | "reject", requestId: string) {
  if (!supabase) throw new Error("The Supabase service is not configured.");

  const { data: request, error: requestError } = await supabase
    .from("booking_requests")
    .select("id,organization_id,status,discord_message_id")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError) throw requestError;
  if (!request || request.status !== "pending_approval") {
    await editInteractionReply(interaction, "This booking request is no longer pending.");
    return;
  }

  if (!interaction.guild_id || !interaction.channel_id || !interaction.message?.id) {
    await editInteractionReply(interaction, "This action must be used from the configured organisation approval channel.");
    return;
  }

  if (request.discord_message_id && request.discord_message_id !== interaction.message.id) {
    await editInteractionReply(interaction, "This approval card does not match the booking request.");
    return;
  }

  const { data: settings, error: settingsError } = await supabase
    .from("discord_settings")
    .select("guild_id,approval_channel_id,allowed_approver_role_ids,enabled")
    .eq("organization_id", request.organization_id)
    .maybeSingle();

  if (settingsError) throw settingsError;

  const memberRoles = interaction.member?.roles ?? [];
  const hasAllowedRole = settings?.allowed_approver_role_ids?.some(
    (roleId: string) => memberRoles.includes(roleId),
  );

  if (
    !settings?.enabled ||
    interaction.guild_id !== settings.guild_id ||
    interaction.channel_id !== settings.approval_channel_id ||
    !hasAllowedRole
  ) {
    await editInteractionReply(interaction, "You are not authorised to review requests for this organisation.");
    return;
  }

  const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
  if (!discordUserId) {
    await editInteractionReply(interaction, "Discord could not identify your account.");
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    await editInteractionReply(
      interaction,
      "Your Discord account is not linked to VEYRO Live yet. Ask an organisation owner to complete account linking before reviewing requests.",
    );
    return;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", request.organization_id)
    .eq("user_id", profile.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    await editInteractionReply(interaction, "Your VEYRO account is not an active owner or administrator of this organisation.");
    return;
  }

  const nextStatus = action === "approve" ? "sync_failed" : "rejected";
  const { data: updated, error: updateError } = await supabase
    .from("booking_requests")
    .update({
      status: nextStatus,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      discord_interaction_id: interaction.id,
    })
    .eq("id", request.id)
    .eq("status", "pending_approval")
    .select("id")
    .maybeSingle();

  if (updateError) {
    if (updateError.code === "23505") {
      await editInteractionReply(interaction, "This interaction has already been processed.");
      return;
    }
    throw updateError;
  }
  if (!updated) {
    await editInteractionReply(interaction, "Another administrator has already reviewed this request.");
    return;
  }

  await supabase.from("audit_events").insert({
    organization_id: request.organization_id,
    actor_user_id: profile.id,
    event_type: action === "approve" ? "booking.discord_approved" : "booking.discord_rejected",
    subject_id: request.id,
    metadata: { discord_user_id: discordUserId },
  });

  if (action === "reject") {
    await markDiscordMessageReviewed(
      interaction.channel_id,
      interaction.message.id,
      "This VEYRO Live booking request was rejected.",
    );
    await editInteractionReply(interaction, "Request rejected. The booking status has been updated in VEYRO Live.");
    return;
  }

  const { error: syncError } = await supabase.functions.invoke("sync-approval", {
    body: { bookingRequestId: request.id },
  });

  if (syncError) {
    await markDiscordMessageReviewed(
      interaction.channel_id,
      interaction.message.id,
      "Approval recorded. Live crew assignment is pending retry.",
    );
    await editInteractionReply(
      interaction,
      "Approval recorded, but Infinite Flight has not confirmed the crew assignment yet. The request remains retryable in VEYRO Live.",
    );
    return;
  }

  const { data: latest } = await supabase
    .from("booking_requests")
    .select("status")
    .eq("id", request.id)
    .maybeSingle();

  if (latest?.status === "approved") {
    await markDiscordMessageReviewed(
      interaction.channel_id,
      interaction.message.id,
      "Approved — Infinite Flight Live confirmed the crew assignment.",
    );
    await editInteractionReply(interaction, "Approved. Infinite Flight Live confirmed the crew assignment.");
  } else {
    await markDiscordMessageReviewed(
      interaction.channel_id,
      interaction.message.id,
      "Approval recorded. Live crew assignment is pending retry.",
    );
    await editInteractionReply(interaction, "Approval recorded. The Live assignment is still being reconciled.");
  }
}

async function handleInteraction(interaction: Interaction): Promise<Response> {
  if (interaction.type === 1) return json({ type: 1 });

  if (interaction.type === 2 && interaction.data?.name === "countdown") {
    if (!interaction.channel_id) {
      return json({ type: 4, data: { content: "Run /countdown inside a server text channel.", flags: 64 } });
    }
    void launchCountdown(interaction.channel_id, env.discordBotToken)
      .then((url) => editInteractionReply(interaction, `VEYRO LIVE countdown is running: ${url}`))
      .catch(async (error) => {
        console.error("Could not launch the countdown:", error);
        await editInteractionReply(interaction, error instanceof Error ? error.message : "Could not start the countdown.");
      });
    return json({ type: 5, data: { flags: 64 } });
  }

  if (interaction.type !== 3) {
    return json({ type: 4, data: { content: "Unsupported interaction.", flags: 64 } });
  }

  const [action, requestId] = String(interaction.data?.custom_id ?? "").split(":");
  if (!["approve", "reject"].includes(action) || !requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return json({ type: 4, data: { content: "This approval action is invalid.", flags: 64 } });
  }

  // Acknowledge within Discord's three-second interaction deadline; finish DB/API work asynchronously.
  void processDecision(interaction, action as "approve" | "reject", requestId).catch(async (error) => {
    console.error("Discord interaction processing failed:", error);
    await editInteractionReply(interaction, "VEYRO could not complete this action. Check the organisation dashboard before trying again.");
  });

  return json({ type: 5, data: { flags: 64 } });
}

Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  hostname: "0.0.0.0",
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json({
        service: "veyro-live-discord",
        status: missing.length === 0 ? "ready" : "configuration_required",
        missing,
      }, missing.length === 0 ? 200 : 503);
    }

    if (url.pathname !== "/discord/interactions") {
      return json({ error: "Not found" }, 404);
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (missing.length > 0) return json({ error: "Discord service is not configured", missing }, 503);

    const rawBody = await request.text();
    if (rawBody.length > 256_000) return json({ error: "Payload too large" }, 413);

    const signature = request.headers.get("x-signature-ed25519") ?? "";
    const timestamp = request.headers.get("x-signature-timestamp") ?? "";
    const timestampMs = Number(timestamp) * 1000;

    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) {
      return json({ error: "Expired Discord interaction" }, 401);
    }

    if (!await verifyDiscordSignature(rawBody, signature, timestamp)) {
      return json({ error: "Invalid Discord signature" }, 401);
    }

    let interaction: Interaction;
    try {
      interaction = JSON.parse(rawBody) as Interaction;
    } catch {
      return json({ error: "Invalid interaction payload" }, 400);
    }

    return handleInteraction(interaction);
  },
});

async function registerCountdownCommand() {
  if (!env.discordBotToken) return;
  const meResponse = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bot ${env.discordBotToken}` },
  });
  if (!meResponse.ok) throw new Error(`Could not identify the Discord bot (${meResponse.status}).`);
  const me = await meResponse.json() as { id: string };
  const commandsUrl = `https://discord.com/api/v10/applications/${me.id}/commands`;
  const currentResponse = await fetch(commandsUrl, {
    headers: { Authorization: `Bot ${env.discordBotToken}` },
  });
  if (!currentResponse.ok) throw new Error(`Could not read existing application commands (${currentResponse.status}).`);
  const currentCommands = await currentResponse.json() as Array<Record<string, unknown> & { name: string }>;
  const commands = currentCommands.filter((command) => command.name !== "countdown");
  commands.push({
    name: "countdown",
    description: "Launch the VEYRO LIVE countdown in this channel.",
    type: 1,
    default_member_permissions: "32",
  });

  const response = await fetch(commandsUrl, {
    method: "PUT",
    headers: { Authorization: `Bot ${env.discordBotToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!response.ok) throw new Error(`Could not register /countdown (${response.status}): ${await response.text()}`);
  console.log("Registered /countdown (Manage Server permission required).");
}

void registerCountdownCommand().catch((error) => console.error("Countdown command registration failed:", error));
void startCountdownService(env.discordBotToken).catch((error) => console.error("Countdown service startup failed:", error));

console.log("VEYRO Live Discord service started.");
