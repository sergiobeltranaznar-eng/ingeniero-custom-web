
exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing OPENAI_API_KEY" })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const formUrl = body.formUrl || "https://forms.gle/ZpJv28ZYqySVSSKL9";
  const messageCount = Number(body.messageCount || 1);
  const message = String(body.message || "").slice(0, 1200);
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

  if (messageCount >= 4) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        locked: true,
        reply: `Para avanzar con rigor necesito fotos, ficha técnica y datos completos. Rellena este formulario y seguimos desde ahí:<br><br><a href="${formUrl}" target="_blank" rel="noopener noreferrer" style="color:#f6b51d;font-weight:900;">Abrir formulario</a>`
      })
    };
  }

  const instructions = `
Eres Sergio B., Ingeniero Custom, especialista en homologación y reforma de motocicletas custom en España.
Estilo: directo, práctico, técnico, sin dar precios.
Objetivo: orientación inicial, detectar viabilidad básica y derivar al formulario.
No sustituyes proyecto técnico, informe de conformidad ni inspección ITV.
No hagas consultas infinitas. Máximo 3-4 respuestas técnicas.
Cuando falten datos, pide formulario.
Si ya se ha derivado al formulario, no sigas resolviendo consultas técnicas.
Formulario: ${formUrl}

Responde breve:
- si parece viable o no
- qué puntos técnicos importan
- qué documentación/fotos hacen falta
- invita al formulario cuando proceda.
`;

  const input = [
    ...history.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 1200)
    })),
    { role: "user", content: message }
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        max_output_tokens: 450
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || "OpenAI API error" })
      };
    }

    const reply =
      data.output_text ||
      data.output?.flatMap(item => item.content || [])
        ?.map(c => c.text || "")
        ?.join("") ||
      `Para poder valorar tu caso necesito fotos, ficha técnica y datos completos. Rellena este formulario: ${formUrl}`;

    return {
      statusCode: 200,
      body: JSON.stringify({ locked: false, reply })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error" })
    };
  }
};
