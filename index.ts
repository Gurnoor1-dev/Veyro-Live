import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.APP_BASE_URL ?? "https://example.invalid",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

async function verifyDiscordSignature(
  raw: string,
  signature: string,
  timestamp: string,
  publicKeyHex: string,
): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(publicKeyHex) || !/^[0-9a-f]{128}$/i.test(signature)) {
    return false;
  }

  const fromHex = (value: string) =>
    new Uint8Array(value.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      fromHex(publicKeyHex),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      fromHex(signature),
      new TextEncoder().encode(timestamp + raw),
    );
  } catch {
    return false;
  }
}

Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (req.method !== "POST") return fail("Method not allowed", 405);

    const raw = await req.text();
    const signature = req.headers.get("x-signature-ed25519") ?? "";
    const timestamp = req.headers.get("x-signature-timestamp") ?? "";
    const publicKey = process.env.DISCORD_PUBLIC_KEY ?? "";

    if (!signature || !timestamp || !publicKey) return fail("Invalid Discord signature", 401);

    const timestampMs = Number(timestamp) * 1000;
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) {
      return fail("Expired Discord interaction", 401);
    }

    if (!await verifyDiscordSignature(raw, signature, timestamp, publicKey)) {
      return fail("Invalid Discord signature", 401);
    }

    let interaction: any;
    try {
      interaction = JSON.parse(raw);
    } catch {
      return fail("Invalid interaction payload", 400);
    }

    if (interaction.type === 1) return json({ type: 1 });
    if (interaction.type !== 3) {
      return json({ type: 4, data: { content: "Unsupported interaction.", flags: 64 } });
    }

    const [action, requestId] = String(interaction.data?.custom_id ?? "").split(":");
    if (!["approve", "reject"].includes(action) || !requestId) {
      return json({ type: 4, data: { content: "Invalid approval action.", flags: 64 } });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) return fail("Bot backend is not configured", 503);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: request } = await admin
      .from("booking_requests")
      .select("id,organization_id,status")
      .eq("id", requestId)
      .maybeSingle();

    if (!request || request.status !== "pending_approval") {
      return json({ type: 4, data: { content: "This request is no longer pending.", flags: 64 } });
    }

    const { data: settings } = await admin
      .from("discord_settings")
      .select("guild_id,approval_channel_id,allowed_approver_role_ids")
      .eq("organization_id", request.organization_id)
      .maybeSingle();

    const roles: string[] = interaction.member?.roles ?? [];
    const allowed = settings &&
      interaction.guild_id === settings.guild_id &&
      interaction.channel_id === settings.approval_channel_id &&
      roles.some((role) => settings.allowed_approver_role_ids.includes(role));

    if (!allowed) {
      return json({ type: 4, data: { content: "You are not authorized to review this request.", flags: 64 } });
    }

    const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
    if (!discordUserId) {
      return json({ type: 4, data: { content: "Could not identify your Discord account.", flags: 64 } });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("discord_user_id", discordUserId)
      .maybeSingle();

    const { data: membership } = profile
      ? await admin
        .from("organization_memberships")
        .select("role")
        .eq("organization_id", request.organization_id)
        .eq("user_id", profile.id)
        .eq("is_active", true)
        .maybeSingle()
      : { data: null };

    if (!profile || !membership || !["owner", "admin"].includes(membership.role)) {
      return json({
        type: 4,
        data: { content: "Link your Discord account to an organization administrator first.", flags: 64 },
      });
    }

    const { data: updated, error } = await admin
      .from("booking_requests")
      .update({
        status: action === "approve" ? "sync_failed" : "rejected",
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        discord_interaction_id: interaction.id,
      })
      .eq("id", request.id)
      .eq("status", "pending_approval")
      .select("id")
      .maybeSingle();

    if (error || !updated) {
      return json({ type: 4, data: { content: "This request was already reviewed or could not be updated.", flags: 64 } });
    }

    if (action === "approve") {
      const { error: invokeError } = await admin.functions.invoke("sync-approval", {
        body: { bookingRequestId: request.id },
      });
      if (invokeError) {
        return json({
          type: 4,
          data: { content: "Approval saved; Live synchronization is awaiting retry.", flags: 64 },
        });
      }
      return json({
        type: 4,
        data: { content: "Approval accepted. Live crew synchronization was requested.", flags: 64 },
      });
    }

    return json({ type: 4, data: { content: "Request rejected.", flags: 64 } });
  },
});
