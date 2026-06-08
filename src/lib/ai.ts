import "server-only";

// OpenRouter（OpenAI 兼容）聊天补全。模型走环境变量，便于按账号可用 slug 调整。
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** 调 OpenRouter 并要求返回 JSON 对象；解析失败做一次大括号截取容错。 */
export async function openRouterJSON(messages: ChatMessage[]): Promise<unknown> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("未配置 OPENROUTER_API_KEY，无法调用 AI");
  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5";

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Datasheet Showcase",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回为空");
  return safeParseJSON(content);
}

function safeParseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try {
        return JSON.parse(text.slice(s, e + 1));
      } catch {
        /* fallthrough */
      }
    }
    throw new Error("AI 返回不是合法 JSON");
  }
}
