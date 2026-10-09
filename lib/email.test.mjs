import assert from "node:assert/strict";
import test from "node:test";
import { sendEmail } from "./email.ts";

const message = {
  to: "colaborador@example.com",
  subject: "Planejamento atualizado",
  text: "Resumo da agenda",
  html: "<p>Resumo da agenda</p>",
};

test("não chama o provedor quando as credenciais de e-mail não estão configuradas", async () => {
  let called = false;
  const fakeFetch = async () => {
    called = true;
    return Response.json({ id: "unexpected" });
  };

  const result = await sendEmail({}, message, fakeFetch);

  assert.deepEqual(result, { status: "not-configured" });
  assert.equal(called, false);
});

test("envia o e-mail transacional sem expor a chave no conteúdo", async () => {
  let request;
  const fakeFetch = async (input, init) => {
    request = { input: String(input), init };
    return Response.json({ id: "email-123" });
  };

  const result = await sendEmail({
    apiKey: "secret-key",
    from: "Orquestra <orquestra@example.com>",
  }, message, fakeFetch);

  assert.deepEqual(result, { status: "sent", id: "email-123" });
  assert.equal(request.input, "https://api.resend.com/emails");
  assert.equal(new Headers(request.init.headers).get("authorization"), "Bearer secret-key");
  assert.deepEqual(JSON.parse(request.init.body), {
    from: "Orquestra <orquestra@example.com>",
    to: ["colaborador@example.com"],
    subject: "Planejamento atualizado",
    text: "Resumo da agenda",
    html: "<p>Resumo da agenda</p>",
  });
});

test("trata falhas do provedor sem repassar detalhes sensíveis", async () => {
  const fakeFetch = async () => new Response("sensitive provider response", { status: 422 });

  const result = await sendEmail({
    apiKey: "secret-key",
    from: "Orquestra <orquestra@example.com>",
  }, message, fakeFetch);

  assert.deepEqual(result, { status: "provider-error" });
});
