import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
Deno.serve(async (req) => {
 if (req.method === "OPTIONS") return json({ ok: true });
 if (req.method !== "POST") return fail("Method not allowed",405);
 const authorization=req.headers.get("Authorization"); if(!authorization)return fail("Unauthorized",401);
 const userClient=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authorization}}});
 const {data:{user}}=await userClient.auth.getUser(); if(!user)return fail("Unauthorized",401);
 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 const [profile,connection,memberships,invites,directory,ownedOrganizations]=await Promise.all([
  admin.from("profiles").select("display_name,discord_user_id,infinite_flight_user_id").eq("id",user.id).maybeSingle(),
  admin.from("user_if_connections").select("token_expires_at,granted_scopes,refresh_token_ciphertext").eq("user_id",user.id).maybeSingle(),
  admin.from("organization_memberships").select("organization_id,role,is_active,created_at").eq("user_id",user.id).eq("is_active",true),
  admin.from("organization_pilot_invites").select("id,organization_id,pilot_name,status,created_at").ilike("email",user.email??"").eq("status","invited"),
  admin.from("organizations").select("id,slug,display_name,logo_url,tagline,description,website_url,discord_invite_url,is_public,live_organization_id").eq("is_active",true).eq("is_public",true).order("display_name"),
  admin.from("organizations").select("id,slug,display_name,logo_url,tagline,description,website_url,discord_invite_url,is_public,live_organization_id,created_at").eq("created_by",user.id).eq("is_active",true)
 ]);
 if(profile.error||connection.error||memberships.error||invites.error||directory.error||ownedOrganizations.error){console.error("[my-portals] query failed",{profile:profile.error?.message,connection:connection.error?.message,memberships:memberships.error?.message,invites:invites.error?.message,directory:directory.error?.message,ownedOrganizations:ownedOrganizations.error?.message});return fail("Could not load your Veyro workspace. Please refresh and try again.",500)}
 const byId=new Map((directory.data??[]).map((org:any)=>[org.id,org]));
 for(const org of ownedOrganizations.data??[])byId.set(org.id,org);
 const ids=[...new Set([...(memberships.data??[]).map((m:any)=>m.organization_id),...(invites.data??[]).map((i:any)=>i.organization_id),...(ownedOrganizations.data??[]).map((o:any)=>o.id)])];
 if(ids.length){const {data,error}=await admin.from("organizations").select("id,slug,display_name,logo_url,tagline,description,website_url,discord_invite_url,is_public,live_organization_id").in("id",ids).eq("is_active",true);if(error)return fail("Could not load your airline portals.",500);for(const org of data??[])byId.set(org.id,org)}
 const memberMap=new Map<string,any>();
 for(const m of memberships.data??[]){const org=byId.get(m.organization_id);if(org&&m.is_active)memberMap.set(m.organization_id,{...org,role:m.role,joinedAt:m.created_at,accessSource:"membership"});}
 for(const org of ownedOrganizations.data??[]){const existing=memberMap.get(org.id);memberMap.set(org.id,{...org,role:"owner",joinedAt:existing?.joinedAt??org.created_at,accessSource:existing?"owner-and-membership":"owner"});}
 const memberRows=[...memberMap.values()].sort((a:any,b:any)=>a.display_name.localeCompare(b.display_name));
 const inviteRows=(invites.data??[]).flatMap((i:any)=>{const org=byId.get(i.organization_id);return org?[{id:i.id,pilotName:i.pilot_name,createdAt:i.created_at,organization:org}]:[]});
 return json({profile:profile.data??null,email:user.email??null,infiniteFlight:{connected:Boolean(connection.data&&((connection.data.token_expires_at&&new Date(connection.data.token_expires_at).getTime()>Date.now())||connection.data.refresh_token_ciphertext)),expiresAt:connection.data?.token_expires_at??null,scopes:connection.data?.granted_scopes??[]},memberships:memberRows,invitations:inviteRows,directory:directory.data??[]});
});