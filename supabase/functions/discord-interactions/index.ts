import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";

async function verify(raw: string, signature: string, timestamp: string, publicKeyHex: string) {
  try {
    const hex = (v: string) => new Uint8Array(v.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    const key = await crypto.subtle.importKey("raw", hex(publicKeyHex), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, hex(signature), new TextEncoder().encode(timestamp + raw));
  } catch { return false; }
}

async function editOriginal(applicationId: string, interactionToken: string, payload: Record<string, unknown>) {
  const response = await fetch("https://discord.com/api/v10/webhooks/" + applicationId + "/" + interactionToken + "/messages/@original", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Discord original response update failed: " + response.status);
}

async function processDecision(interaction: any, action: string, requestId: string) {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const applicationId = String(interaction.application_id ?? "");
  const token = String(interaction.token ?? "");
  try {
    const { data: request, error: requestError } = await admin.from("booking_requests")
      .select("id,organization_id,status,reference_code,discord_message_id,reviewed_at").eq("id", requestId).maybeSingle();
    if (requestError || !request || request.status !== "pending_approval") {
      await editOriginal(applicationId, token, { content: "This request is no longer pending.", components: [] });
      return;
    }
    const { data: settings, error: settingsError } = await admin.from("discord_settings")
      .select("guild_id,approval_channel_id,allowed_approver_role_ids").eq("organization_id", request.organization_id).maybeSingle();
    const roles: string[] = interaction.member?.roles ?? [];
    const allowedRoles: string[] = Array.isArray(settings?.allowed_approver_role_ids) ? settings.allowed_approver_role_ids : [];
    const allowed = !settingsError && settings && interaction.guild_id === settings.guild_id
      && interaction.channel_id === settings.approval_channel_id && roles.some((role) => allowedRoles.includes(role));
    if (!allowed) {
      await editOriginal(applicationId, token, { content: "Review not authorized. Check the configured approver role and channel.", components: [] });
      return;
    }
    const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
    const { data: profile } = await admin.from("profiles").select("id").eq("discord_user_id", discordUserId).maybeSingle();
    const { data: membership } = profile ? await admin.from("organization_memberships").select("role")
      .eq("organization_id", request.organization_id).eq("user_id", profile.id).eq("is_active", true).maybeSingle() : { data: null };
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      await editOriginal(applicationId, token, { content: "Link your Discord account to an organization administrator first.", components: [] });
      return;
    }
    const nextStatus = action === "approve" ? "sync_failed" : "rejected";
    const { data: updated, error: updateError } = await admin.from("booking_requests").update({
      status: nextStatus, reviewed_by: profile.id, reviewed_at: new Date().toISOString(), discord_interaction_id: interaction.id,
    }).eq("id", request.id).eq("status", "pending_approval").select("id").maybeSingle();
    if (updateError || !updated) {
      await editOriginal(applicationId, token, { content: "This request was already reviewed or could not be updated.", components: [] });
      return;
    }
    const reviewer = interaction.member?.user?.global_name || interaction.member?.user?.username || interaction.user?.global_name || interaction.user?.username || "Organisation administrator";
    const reviewedAt = new Date().toISOString();
    const updateEmbed = async (status: "APPROVED" | "REJECTED" | "PENDING") => {
      const source = interaction.message?.embeds?.[0] ?? {};
      const fields = Array.isArray(source.fields) ? [...source.fields] : [];
      const approvedIndex = fields.findIndex((field: any) => field.name === "Approved by");
      const reviewIndex = fields.findIndex((field: any) => field.name === "Reviewed by");
      const approverField = { name: status === "APPROVED" ? "Approved by" : "Reviewed by", value: (status === "PENDING" ? "Sync pending" : reviewer) + " · " + (status === "PENDING" ? "—" : reviewedAt.replace("T", " ").slice(0, 16) + " UTC") + " · " + (request.reference_code || "------"), inline: false };
      if (approvedIndex >= 0) fields.splice(approvedIndex, 1);
      if (reviewIndex >= 0) fields.splice(reviewIndex, 1);
      fields.push(approverField);
      const embed = { title: "CREW REQUEST · " + status, description: source.description, url: source.url, timestamp: source.timestamp, color: status === "APPROVED" ? 5763719 : status === "REJECTED" ? 15548997 : 16763904, footer: source.footer, author: source.author, thumbnail: source.thumbnail, image: source.image, fields };
      await editOriginal(applicationId, token, { embeds: [embed], components: [] });
    };
    if (action === "reject") {
      await updateEmbed("REJECTED");
      return;
    }
    const syncResponse = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/sync-approval", {
      method: "POST", headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: "Bearer " + serviceKey },
      body: JSON.stringify({ bookingRequestId: request.id }),
    });
    const syncResult = await syncResponse.json().catch(() => null);
    if (!syncResponse.ok || !syncResult?.success) {
      await updateEmbed("PENDING");
      return;
    }
    await updateEmbed("APPROVED");
  } catch (error) {
    console.error("[discord-interactions] decision processing failed", error instanceof Error ? error.message : String(error));
    try { await editOriginal(applicationId, token, { content: "The decision could not be completed. Please retry or contact an administrator.", components: [] }); } catch { /* interaction token may have expired */ }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const raw = await req.text();
  const signature = req.headers.get("x-signature-ed25519") ?? "";
  const timestamp = req.headers.get("x-signature-timestamp") ?? "";
  const publicKey = Deno.env.get("DISCORD_PUBLIC_KEY") ?? "";
  if (!signature || !timestamp || !publicKey) return fail("Invalid Discord signature", 401);
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) return fail("Expired Discord interaction", 401);
  if (!await verify(raw, signature, timestamp, publicKey)) return fail("Invalid Discord signature", 401);
  let interaction: any;
  try { interaction = JSON.parse(raw); } catch { return fail("Invalid interaction payload", 400); }
  if (interaction.type === 1) return json({ type: 1 });
  if (interaction.type !== 3) return json({ type: 4, data: { content: "Unsupported interaction.", flags: 64 } });
  const [action, requestId] = String(interaction.data?.custom_id ?? "").split(":");
  if (!["approve", "reject"].includes(action) || !requestId) return json({ type: 4, data: { content: "Invalid approval action.", flags: 64 } });
  // Acknowledge the component within Discord's three-second deadline. All database
  // checks and Live synchronization run after the interaction has been accepted.
  EdgeRuntime.waitUntil(processDecision(interaction, action, requestId));
  return json({ type: 6 });
});
