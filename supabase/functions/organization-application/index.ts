import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { decryptSecret, encryptSecret } from "../_shared/crypto.ts";
import { ifRequest, refreshAuthorizationToken, IfApiRateLimitError } from "../_shared/infinite-flight.ts";

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const hex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
const hash = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
const trackingCode = () => "VY-" + Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

async function userFromRequest(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user } } = await client.auth.getUser();
  return user ?? null;
}

async function connectionFor(userId: string, pendingId?: string) {
  const db = admin();
  const { data: saved } = await db.from("user_if_connections").select("*").eq("user_id", userId).maybeSingle();
  if (saved) {
    let accessToken = await decryptSecret(saved.access_token_ciphertext);\n    let accessCipher = saved.access_token_ciphertext;\n    let refreshCipher = saved.refresh_token_ciphertext;\n    let expiresAt = saved.token_expires_at;
    if (saved.token_expires_at && new Date(saved.token_expires_at).getTime() < Date.now() + 60_000) {
      if (!saved.refresh_token_ciphertext) throw new Error("Your Infinite Flight connection expired. Reconnect Infinite Flight and try again.");
      const refreshed = await refreshAuthorizationToken(await decryptSecret(saved.refresh_token_ciphertext));
      accessToken = String(refreshed.access_token);
      const refreshToken = refreshed.refresh_token ? String(refreshed.refresh_token) : await decryptSecret(saved.refresh_token_ciphertext);
      await db.from("user_if_connections").update({
        access_token_ciphertext: await encryptSecret(accessToken),
        refresh_token_ciphertext: await encryptSecret(refreshToken),
        token_expires_at: new Date(Date.now() + Number(refreshed.expires_in ?? 1800) * 1000).toISOString(),
      }).eq("user_id", userId);
    }
    return { accessToken, accessCipher, refreshCipher, expiresAt, scopes: saved.granted_scopes ?? [] };
  }
  if (!pendingId) throw new Error("Connect your Infinite Flight account before applying.");
  const { data: pending } = await db.from("oauth_pending_connections").select("*").eq("id", pendingId).eq("user_id", userId).single();
  if (!pending || new Date(pending.expires_at).getTime() < Date.now()) throw new Error("Your Infinite Flight authorization expired. Reconnect and try again.");
  return {
    accessToken: await decryptSecret(pending.access_token_ciphertext),
    accessCipher: pending.access_token_ciphertext,
    refreshCipher: pending.refresh_token_ciphertext,
    expiresAt: pending.access_token_expires_at,
    scopes: pending.granted_scopes ?? [],
  };
}

async function eligibleOrganizations(userId: string, pendingId?: string) {
  const connection = await connectionFor(userId, pendingId);
  const live = await ifRequest<Array<{ id: string; name?: string; role: number }>>(connection.accessToken, "/live/organizations");
  const db = admin();
  const ids = live.filter((o) => [1, 2].includes(o.role)).map((o) => o.id);
  const { data: existing } = ids.length ? await db.from("organizations").select("live_organization_id,slug").in("live_organization_id", ids) : { data: [] };
  const { data: applications } = ids.length ? await db.from("organization_applications").select("live_organization_id,status").in("live_organization_id", ids).in("status", ["pending", "approved"]) : { data: [] };
  const blocked = new Set([...(existing ?? []).map((o) => o.live_organization_id), ...(applications ?? []).map((a) => a.live_organization_id)]);
  return {
    connection,
    organizations: live.filter((o) => [1, 2].includes(o.role)).map((o) => ({
      id: o.id, name: o.name ?? "Live organization", role: o.role,
      alreadyConnected: blocked.has(o.id),
    })),
  };
}

async function sendApplicationToDiscord(application: Record<string, unknown>) {
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const channelId = Deno.env.get("DISCORD_APPLICATION_CHANNEL_ID");
  const expectedGuildId = Deno.env.get("DISCORD_APPLICATION_GUILD_ID");
  if (!botToken || !channelId || !expectedGuildId) throw new Error("Discord application review is not configured. Ask the VEYRO team to configure its review channel.");
  const headers = { Authorization: "Bot " + botToken, "Content-Type": "application/json" };
  const channelResponse = await fetch("https://discord.com/api/v10/channels/" + channelId, { headers: { Authorization: headers.Authorization } });
  if (!channelResponse.ok) throw new Error("The configured Discord review channel could not be accessed.");
  const channel = await channelResponse.json();
  if (channel.guild_id !== expectedGuildId) throw new Error("The configured review channel does not belong to the configured Discord server.");
  const embed = {
    title: "New VEYRO Live organisation application",
    color: 0x64748b,
    thumbnail: application.logo_url ? { url: application.logo_url } : undefined,
    description: String(application.description),
    fields: [
      { name: "Organisation", value: String(application.display_name), inline: true },
      { name: "Infinite Flight organisation", value: String(application.live_organization_name) + " (" + String(application.live_organization_id) + ")", inline: true },
      { name: "Applicant role", value: Number(application.live_role) === 2 ? "Owner" : "Admin", inline: true },
      { name: "Requested portal", value: "/" + String(application.requested_slug), inline: true },
      { name: "Tagline", value: String(application.tagline), inline: false },
      { name: "Website", value: String(application.website_url || "Not provided"), inline: true },
      { name: "Discord", value: String(application.discord_invite_url || "Not provided"), inline: true },
      { name: "Tracking code", value: String(application.tracking_code), inline: true },
      { name: "Applicant", value: String(application.applicant_email), inline: false },
    ],
    footer: { text: "Application ID: " + String(application.id) },
    timestamp: new Date().toISOString(),
  };
  const response = await fetch("https://discord.com/api/v10/channels/" + channelId + "/messages", {
    method: "POST", headers,
    body: JSON.stringify({
      embeds: [embed],
      components: [{ type: 1, components: [
        { type: 2, style: 3, label: "Approve", custom_id: "orgapp:approve:" + String(application.id) },
        { type: 2, style: 4, label: "Reject", custom_id: "orgapp:reject:" + String(application.id) },
        { type: 2, style: 2, label: "Add note", custom_id: "orgapp:note:" + String(application.id) },
      ] }],
    }),
  });
  if (!response.ok) throw new Error("Discord could not accept the application message.");
  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const db = admin();

  try {
    if (action === "directory") {
      const { data, error } = await db.from("organizations").select("id,slug,display_name,logo_url,tagline,description,website_url,discord_invite_url").eq("is_public", true).eq("is_active", true).order("display_name");
      if (error) return fail("Could not load the organisation directory.", 500);
      return json({ organizations: data ?? [] });
    }

    if (action === "status") {
      const code = String(body.trackingCode ?? "").trim().toUpperCase();
      if (!/^VY-[A-HJ-NP-Z2-9]{8}$/.test(code)) return fail("Enter a valid tracking code.", 400);
      const { data: application } = await db.from("organization_applications").select("id,live_organization_name,display_name,requested_slug,tagline,description,logo_url,status,created_at,reviewed_at,created_organization_id").eq("tracking_code_hash", await hash(code)).maybeSingle();
      if (!application) return fail("No application was found for that tracking code.", 404);
      const { data: notes } = await db.from("organization_application_notes").select("id,author_display_name,note,created_at").eq("application_id", application.id).eq("is_public", true).order("created_at");
      let portal = null;
      if (application.status === "approved" && application.created_organization_id) {
        const { data } = await db.from("organizations").select("slug,display_name").eq("id", application.created_organization_id).maybeSingle();
        portal = data;
      }
      return json({ application: { ...application, id: undefined }, notes: notes ?? [], portal });
    }

    const user = await userFromRequest(req);
    if (!user) return fail("Sign in to continue.", 401);

    if (action === "eligible-organizations") {
      const result = await eligibleOrganizations(user.id, body.pendingId ? String(body.pendingId) : undefined);
      return json({ organizations: result.organizations });
    }

    if (action === "submit") {
      const liveOrganizationId = String(body.liveOrganizationId ?? "");
      const pendingId = body.pendingId ? String(body.pendingId) : undefined;
      const displayName = String(body.displayName ?? "").trim().slice(0, 80);
      const tagline = String(body.tagline ?? "").trim().slice(0, 120);
      const description = String(body.description ?? "").trim().slice(0, 1200);
      const requestedSlug = slugify(String(body.requestedSlug ?? displayName));
      const websiteUrl = String(body.websiteUrl ?? "").trim();
      const discordInviteUrl = String(body.discordInviteUrl ?? "").trim();
      if (!liveOrganizationId || displayName.length < 2 || tagline.length < 8 || description.length < 40 || !requestedSlug) return fail("Complete the required organisation details.", 400);
      for (const value of [websiteUrl, discordInviteUrl].filter(Boolean)) {
        const parsed = new URL(value);
        if (parsed.protocol !== "https:") return fail("Website and Discord links must use HTTPS.", 400);
      }

      const result = await eligibleOrganizations(user.id, pendingId);
      const selected = result.organizations.find((o) => o.id === liveOrganizationId);
      if (!selected) return fail("You must be an Infinite Flight Owner or Admin of the selected organisation.", 403);
      if (selected.alreadyConnected) return fail("This organisation already has an application or a Veyro portal.", 409);
      const { data: slugMatch } = await db.from("organizations").select("id").eq("slug", requestedSlug).maybeSingle();
      const { data: applicationSlugMatch } = await db.from("organization_applications").select("id").eq("requested_slug", requestedSlug).in("status", ["pending", "approved"]).maybeSingle();
      if (slugMatch || applicationSlugMatch) return fail("That portal URL is already reserved. Choose another slug.", 409);

      let logoUrl: string | null = null;
      if (body.logoDataUrl) {
        const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.logoDataUrl));
        if (!match) return fail("Upload a PNG, JPG or WebP logo.", 400);
        const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
        if (bytes.length > 2 * 1024 * 1024) return fail("The logo must be smaller than 2 MB.", 400);
        const extension = match[1] === "image/jpeg" ? "jpg" : match[1].split("/")[1];
        const path = liveOrganizationId + "/" + crypto.randomUUID() + "." + extension;
        const { error: uploadError } = await db.storage.from("organization-logos").upload(path, bytes, { contentType: match[1], upsert: false });
        if (uploadError) return fail("The organisation logo could not be uploaded.", 500);
        logoUrl = db.storage.from("organization-logos").getPublicUrl(path).data.publicUrl;
      }

      const code = trackingCode();
      const { data: inserted, error: insertError } = await db.from("organization_applications").insert({
        tracking_code_hash: await hash(code), submitted_by: user.id, live_organization_id: selected.id,
        live_organization_name: selected.name, live_role: selected.role, display_name: displayName,
        requested_slug: requestedSlug, tagline, description, website_url: websiteUrl || null,
        discord_invite_url: discordInviteUrl || null, logo_url: logoUrl,
      }).select("id,live_organization_id,live_organization_name,live_role,display_name,requested_slug,tagline,description,website_url,discord_invite_url,logo_url").single();
      if (insertError || !inserted) return fail(insertError?.code === "23505" ? "An application for this organisation is already pending." : "Could not save your application.", 409);

      try {
        const message = await sendApplicationToDiscord({ ...inserted, tracking_code: code, applicant_email: user.email ?? "Email unavailable" });
        await db.from("organization_applications").update({ discord_guild_id: Deno.env.get("DISCORD_APPLICATION_GUILD_ID"), discord_channel_id: message.channel_id, discord_message_id: message.id }).eq("id", inserted.id);
      } catch (error) {
        await db.from("organization_applications").delete().eq("id", inserted.id);
        if (logoUrl) {
          const path = new URL(logoUrl).pathname.split("/organization-logos/")[1];
          if (path) await db.storage.from("organization-logos").remove([decodeURIComponent(path)]);
        }
        throw error;
      }

      const connection = result.connection;
      await db.from("user_if_connections").upsert({
        user_id: user.id, access_token_ciphertext: connection.accessCipher,
        refresh_token_ciphertext: connection.refreshCipher, token_expires_at: connection.expiresAt,
        granted_scopes: connection.scopes,
      }, { onConflict: "user_id" });
      return json({ ok: true, trackingCode: code, statusUrl: "/application-status/" + code });
    }
    return fail("Unknown action.", 400);
  } catch (error) {
    if (error instanceof IfApiRateLimitError) return fail(error.message, 429, { "Retry-After": String(error.retryAfterSeconds) });
    return fail(error instanceof Error ? error.message : "The application request failed.", 500);
  }
});
