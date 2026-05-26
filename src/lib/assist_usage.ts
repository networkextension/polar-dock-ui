// Shared LLM-usage badge for the assist UIs (issue #170).
//
// All three "AI 润色 / 起草 / 评论草稿" call sites (editor, creation
// bubble, posts plaza post + reply) consume MarkdownAssistResponse and
// append a status-line suffix after the model name. This helper keeps
// the badge format consistent across them and the "no usage from this
// provider" fallback graceful (Anthropic / Gemini / xAI Responses leave
// usage nil on the non-streaming path; we render nothing in that case
// instead of an em-dash placeholder).

export type AssistUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
};

export function formatAssistUsageBadge(usage?: AssistUsage): string {
  if (!usage) {
    return "";
  }
  const total = usage.total_tokens ?? usage.prompt_tokens + usage.completion_tokens;
  return ` · ${total} tok (${usage.prompt_tokens}→${usage.completion_tokens})`;
}
