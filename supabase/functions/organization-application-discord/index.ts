import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";

const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const hex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

async function verify(raw: string, signature: string, timestamp: string, publicKeyHex: string) {
  if (!/^[0-9a-f]{128}$/i.test(signature) || !/^[0-9a-f]{64}$/i.test(publicKeyHex)) return false;
  const bytes = (value: string) => new Uint8Array(value.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const key = await crypto.subtle.importKey("raw", bytes(publicKeyHex), { name: "Ed25519" }, false, ["verify"]);
  return crypto.subtle.verify({ name: "Ed25519" }, key, bytes(signature), new TextEncoder().encode(timestamp + raw));
}

function reviewerAllowed(interaction: any) {
  const guild = Deno.env.get("DISCORD_APPLICATION_GUILD_ID");
  const channel = Deno.env.get("DISCORD_APPLICATION_CHANNEL_ID");
  const allowedRoles = (Deno.env.get("DISCORD_APPLICATION_REVIEWER_ROLE_IDS") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  const roles: string[] = interaction.member?.roles ?? [];
  return Boolean(guild && channel && interaction.guild_id === guild && interaction.channel_id === channel && allowedRoles.length && roles.some((role) => allowedRoles.includes(role)));
}

async function approveApplication(application: any, reviewerId: string) {
  const admin = db();
  const { data: existing } = await admin.from("organizations").select("id").or("slug.eq." + application.requested_slug + ",live_organization_id.eq." + application.live_organization_id).maybeSingle();
  if (existing) throw new Error("A portal for this organisation or requested URL already exists. Resolve the conflict before approving.");

  const { data: connection } = await admin.from("user_if_connections").select("*").eq("user_id", application.submitted_by).maybeSingle();
  if (!connection) throw new Error("The applicant's Infinite Flight connection is no longer available. Ask them to reconnect and resubmit.");

  const { data: authUser } = await admin.auth.admin.getUserById(application.submitted_by);
  await admin.from("profiles").upsert({ id: application.submitted_by, display_name: authUser.user?.user_metadata?.name ?? authUser.user?.email?.split("@")[0] ?? "Pilot" }, { onConflict: "id", ignoreDuplicates: true });

  const { data: org, error: orgError } = await admin.from("organizations").insert({
    slug: application.requested_slug,
    display_name: application.display_name,
    tagline: application.tagline,
    description: application.description,
    website_url: application.website_url,
    discord_invite_url: application.discord_invite_url,
    logo_url: application.logo_url,
    is_public: true,
    live_organization_id: application.live_organization_id,
    created_by: application.submitted_by,
    is_active: true,
  }).select("id,slug,display_name").single();
  if (orgError || !org) throw new Error("Could not create the organisation portal. The requested slug may already be taken.");

  const { error: memberError } = await admin.from("organization_memberships").insert({ organization_id: org.id, user_id: application.submitted_by, role: "owner", is_active: true });
  if (memberError) {
    await admin.from("organizations").delete().eq("id", org.id);
    throw new Error("Could not create the initial organisation owner membership.");
  }
  const { error: ifError } = await admin.from("if_connections").insert({
    organization_id: org.id, connected_by: application.submitted_by,
    access_token_ciphertext: connection.access_token_ciphertext,
    refresh_token_ciphertext: connection.refresh_token_ciphertext,
    token_expires_at: connection.token_expires_at,
    granted_scopes: connection.granted_scopes, live_role: application.live_role,
  });
  if (ifError) {
    await admin.from("organization_memberships").delete().eq("organization_id", org.id);
    await admin.from("organizations").delete().eq("id", org.id);
    throw new Error("Could not attach the organisation's Infinite Flight connection.");
  }
  const { error: updateError } = await admin.from("organization_applications").update({
    status: "approved", reviewer_discord_id: reviewerId, reviewed_at: new Date().toISOString(), created_organization_id: org.id,
  }).eq("id", application.id).eq("status", "pending");
  if (updateError) throw new Error("The portal was created but the application status could not be updated. Contact VEYRO support.");
  return org;
}

async function handleBookingReview(interaction: any, action: "approve" | "reject", bookingId: string) {
  const admin = db();
  const { data: booking } = await admin.from("booking_requests").select("*").eq("id", bookingId).maybeSingle();
  if (!booking || booking.status !== "pending_approval") return;
  const { data: settings } = await admin.from("discord_settings").select("guild_id,approval_channel_id,allowed_approver_role_ids,enabled").eq("organization_id", booking.organization_id).maybeSingle();
  const roles: string[] = interaction.member?.roles ?? [];
  const authorizedChannel = settings?.enabled && interaction.guild_id === settings.guild_id && interaction.channel_id === settings.approval_channel_id;
  const authorizedRole = settings && roles.some((role) => settings.allowed_approver_role_ids.includes(role));
  if (!authorizedChannel || !authorizedRole) return;
  const discordUser = interaction.member?.user ?? interaction.user ?? {};
  const discordUserId = String(discordUser.id ?? "");
  const reviewerName = String(discordUser.global_name || discordUser.username || "Organization administrator").slice(0, 80);
  const { data: profile } = await admin.from("profiles").select("id").eq("discord_user_id", discordUserId).maybeSingle();
  const { data: membership } = profile ? await admin.from("organization_memberships").select("role").eq("organization_id", booking.organization_id).eq("user_id", profile.id).eq("is_active", true).maybeSingle() : { data: null };
  if (!profile || !membership || !["owner", "admin"].includes(membership.role)) return;
  const { error } = await admin.from("booking_requests").update({
    status: action === "approve" ? "sync_failed" : "rejected",
    reviewed_by: profile.id, reviewed_at: new Date().toISOString(), discord_interaction_id: interaction.id
  }).eq("id", booking.id).eq("status", "pending_approval");
  if (error) throw error;
  let finalStatus = action === "reject" ? "rejected" : "sync_failed";
  if (action === "approve") {
    const { error: syncError } = await admin.functions.invoke("sync-approval", { body: { bookingRequestId: booking.id } });
    if (!syncError) {
      const { data: refreshed } = await admin.from("booking_requests").select("status").eq("id", booking.id).maybeSingle();
      finalStatus = refreshed?.status ?? "sync_failed";
    }
  }
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const { data: pilot } = await admin.from("profiles").select("display_name").eq("id", booking.pilot_user_id).maybeSingle();
  if (botToken && booking.discord_message_id && settings?.approval_channel_id) {
    const title = finalStatus === "approved" ? "Flight leg approved" : finalStatus === "rejected" ? "Flight leg rejected" : "Approval saved · Live sync pending";
    const color = finalStatus === "approved" ? 0x16a36a : finalStatus === "rejected" ? 0xd94b4b : 0xd99b32;
    const description = finalStatus === "approved"
      ? "Approved for " + (pilot?.display_name || booking.pilot_if_user_id) + " by " + reviewerName + "."
      : finalStatus === "rejected" ? "Rejected for " + (pilot?.display_name || booking.pilot_if_user_id) + " by " + reviewerName + "." : "Reviewed by " + reviewerName + ". Live crew assignment still needs synchronization.";
    await fetch("https://discord.com/api/v10/channels/" + settings.approval_channel_id + "/messages/" + booking.discord_message_id, {
      method: "PATCH", headers: { Authorization: "Bot " + botToken, "Content-Type": "application/json" },
      body: JSON.stringify({ content: "", embeds: [{ title, description, color, footer: { text: "VEYRO Live · " + booking.id } }], components: [] })
    });
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

  const interaction = JSON.parse(raw);
  if (interaction.type === 1) return json({ type: 1 });
  const bookingMatch = String(interaction.data?.custom_id ?? "").match(/^(approve|reject):([0-9a-f-]{36})$/i);
  if (interaction.type === 3 && bookingMatch) {
    const action = bookingMatch[1].toLowerCase() as "approve" | "reject";
    const task = handleBookingReview(interaction, action, bookingMatch[2]);
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(task);
    else await task;
    return json({ type: 6 });
  }
  if (!reviewerAllowed(interaction)) return json({ type: 4, data: { content: "You are not authorised to review VEYRO organisation applications in this channel.", flags: 64 } });

  const customId = String(interaction.data?.custom_id ?? "");
  const parts = customId.split(":");
  const action = parts[1];
  const applicationId = parts[2];
  if (parts[0] !== "orgapp" || !applicationId) return json({ type: 4, data: { content: "Invalid application action.", flags: 64 } });

  const admin = db();
  const reviewer = interaction.member?.user ?? interaction.user ?? {};
  const reviewerId = String(reviewer.id ?? "");
  const reviewerName = String(reviewer.global_name || reviewer.username || "Discord reviewer").slice(0, 80);

  if (interaction.type === 3 && action === "note") {
    return json({ type: 9, data: {
      custom_id: "orgapp:note_submit:" + applicationId,
      title: "Add applicant note",
      components: [{ type: 1, components: [{ type: 4, custom_id: "note", label: "Note shown on the status page", style: 2, min_length: 3, max_length: 1500, required: true, placeholder: "Write an update or request for the applicant…" }] }],
    } });
  }

  if (interaction.type === 5 && action === "note_submit") {
    const note = String(interaction.data?.components?.[0]?.components?.[0]?.value ?? "").trim();
    if (note.length < 3 || note.length > 1500) return json({ type: 4, data: { content: "Notes must be between 3 and 1,500 characters.", flags: 64 } });
    const { data: application } = await admin.from("organization_applications").select("id,status").eq("id", applicationId).maybeSingle();
    if (!application) return json({ type: 4, data: { content: "Application not found.", flags: 64 } });
    const { error } = await admin.from("organization_application_notes").insert({ application_id: applicationId, author_discord_id: reviewerId, author_display_name: reviewerName, note, is_public: true });
    if (error) return json({ type: 4, data: { content: "Could not save the note.", flags: 64 } });
    return json({ type: 4, data: { content: "Your note has been added to the applicant's tracking page.", flags: 64 } });
  }

  if (interaction.type !== 3 || !["approve", "reject"].includes(action)) {
    return json({ type: 4, data: { content: "Unsupported application action.", flags: 64 } });
  }
  const { data: application } = await admin.from("organization_applications").select("*").eq("id", applicationId).maybeSingle();
  if (!application || application.status !== "pending") return json({ type: 4, data: { content: "This application is no longer pending.", flags: 64 } });

  if (action === "reject") {
    const { error } = await admin.from("organization_applications").update({ status: "rejected", reviewer_discord_id: reviewerId, reviewed_at: new Date().toISOString() }).eq("id", applicationId).eq("status", "pending");
    if (error) return json({ type: 4, data: { content: "Could not reject this application.", flags: 64 } });
    return json({ type: 7, data: { content: "Organisation application rejected.", embeds: [], components: [] } });
  }

  try {
    const org = await approveApplication(application, reviewerId);
    return json({ type: 7, data: { content: "Organisation application approved · portal created: /" + org.slug, embeds: [], components: [] } });
  } catch (error) {
    return json({ type: 4, data: { content: error instanceof Error ? error.message : "Approval failed.", flags: 64 } });
  }
});
