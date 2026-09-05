import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};
const RECIPIENT = "info@grandessaschool.com.ng";
const SENDER = "Grandessa Smart Campus <no-reply@grandessaschool.com.ng>";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);

  try {
    const payload = await request.json() as { name?: string; phone?: string; email?: string; message?: string };
    const name = payload.name?.trim() ?? "";
    const phone = payload.phone?.trim() ?? "";
    const email = payload.email?.trim().toLowerCase() ?? "";
    const message = payload.message?.trim() ?? "";

    if (!name || name.length > 120 || !email || !isEmail(email) || !message || message.length > 5000 || phone.length > 40) {
      return response({ error: "Please provide a valid name, email address, and message." }, 400);
    }

    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#243424">
      <h2 style="color:#0f6b35">New Website Enquiry - Grandessa School</h2>
      <p><strong>From:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone || "Not provided")}</p>
      <p><strong>Message:</strong></p>
      <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      <p><strong>Source:</strong> Grandessa School Website</p>
      <p><strong>Received:</strong> ${escapeHtml(new Date().toISOString())}</p>
    </div>`;
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: SENDER, to: [RECIPIENT], reply_to: email, subject: `New Website Enquiry - ${name}`, html, text: `New Website Enquiry - Grandessa School\n\nFrom: ${name}\nEmail: ${email}\nPhone: ${phone || "Not provided"}\n\n${message}\n\nSource: Grandessa School Website` }),
    });

    if (!result.ok) {
      console.error("Contact enquiry email was not accepted", result.status);
      return response({ error: "Your message could not be sent. Please try again later." }, 502);
    }

    return response({ ok: true });
  } catch (error) {
    console.error("Contact enquiry request failed", error instanceof Error ? error.message : "Unknown error");
    return response({ error: "Your message could not be sent. Please try again later." }, 500);
  }
});
