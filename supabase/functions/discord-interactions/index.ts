import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
async function verify(raw: string, signature: string, timestamp: string, publicKeyHex: string) {
  const hex = (v: string) => new Uint8Array(v.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  const key = await crypto.subtle.importKey("raw", hex(publicKeyHex), { name: "Ed25519" }, false, ["verify"]);
  return crypto.subtle.verify({ name: "Ed25519" }, key, hex(signature), new TextEncoder().encode(timestamp + raw));
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
  const interaction = JSON.parse(raw);
  if (interaction.type === 1) return json({ type: 1 });
  if (interaction.type !== 3) return json({ type: 4, data: { content: "Unsupported interaction.", flags: 64 } });
  const [action, requestId] = String(interaction.data?.custom_id ?? "").split(":");
  if (!["approve", "reject"].includes(action) || !requestId) return json({ type: 4, data: { content: "Invalid approval action.", flags: 64 } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: request } = await admin.from("booking_requests").select("id,organization_id,status").eq("id", requestId).single();
  if (!request || request.status !== "pending_approval") return json({ type: 4, data: { content: "This request is no longer pending.", flags: 64 } });
  const { data: settings } = await admin.from("discord_settings").select("guild_id,approval_channel_id,allowed_approver_role_ids").eq("organization_id", request.organization_id).single();
  const roles = interaction.member?.roles ?? [];
  const allowed = settings && interaction.guild_id === settings.guild_id && interaction.channel_id === settings.approval_channel_id && roles.some((role: string) => settings.allowed_approver_role_ids.includes(role));
  if (!allowed) return json({ type: 4, data: { content: "You are not authorized to review this request.", flags: 64 } });
  const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
  const { data: profile } = await admin.from("profiles").select("id").eq("discord_user_id", discordUserId).single();
  const { data: membership } = profile ? await admin.from("organization_memberships").select("role").eq("organization_id", request.organization_id).eq("user_id", profile.id).eq("is_active", true).single() : { data: null };
  if (!membership || !["owner", "admin"].includes(membership.role)) return json({ type: 4, data: { content: "Link your Discord account to an organization administrator first.", flags: 64 } });
  const { error } = await admin.from("booking_requests").update({ status: action === "approve" ? "sync_failed" : "rejected", reviewed_by: profile.id, reviewed_at: new Date().toISOString(), discord_interaction_id: interaction.id }).eq("id", request.id).eq("status", "pending_approval");
  if (error) return json({ type: 4, data: { content: "Could not record this decision.", flags: 64 } });
  if (action === "approve") {
    const { error: invokeError } = await admin.functions.invoke("sync-approval", { body: { bookingRequestId: request.id } });
    if (invokeError) return json({ type: 4, data: { content: "Approval saved; Live synchronization is awaiting retry.", flags: 64 } });
    return json({ type: 4, data: { content: "Approval accepted. Live crew synchronization was requested.", flags: 64 } });
  }
  return json({ type: 4, data: { content: "Request rejected.", flags: 64 } });
});
