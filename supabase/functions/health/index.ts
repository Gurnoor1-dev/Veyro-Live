import { json } from "../_shared/http.ts";
Deno.serve(() => json({ ok: true, service: "veyro-live-edge", version: "0.1.0" }));
