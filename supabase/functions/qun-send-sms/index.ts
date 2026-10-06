import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET")?.replace("v1,whsec_", "");
const providerUser = Deno.env.get("PROVIDER_USER");
const providerKey = Deno.env.get("PROVIDER_KEY");
const providerSender = Deno.env.get("PROVIDER_SENDER") || "Serega40in";

function basicAuth(user: string, key: string) {
  return "Basic " + btoa(`${user}:${key}`);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!hookSecret || !providerUser || !providerKey) {
    console.error("Required server-side secrets are missing");
    return new Response(JSON.stringify({ error: "Server configuration incomplete" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    const wh = new Webhook(hookSecret);

    const { user, sms } = wh.verify(payload, headers) as {
      user: { phone?: string };
      sms: { otp?: string };
    };

    if (!user?.phone || !sms?.otp) {
      return new Response(JSON.stringify({ error: "Invalid hook payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://gate.smsaero.ru/v2/sms/send", {
      method: "POST",
      headers: {
        "Authorization": basicAuth(providerUser, providerKey),
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        number: user.phone,
        text: `Код QUN: ${sms.otp}. Никому его не сообщайте.`,
        sign: providerSender,
      }),
    });

    const bodyText = await response.text();

    if (!response.ok) {
      console.error("SMS provider error", response.status, bodyText);
      return new Response(JSON.stringify({ error: "SMS provider rejected the request" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("SMS hook error", error);
    return new Response(JSON.stringify({ error: "SMS hook failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
