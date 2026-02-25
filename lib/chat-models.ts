export interface ChatModel {
    id: string
    name: string
    icon: string
    free: boolean
}

export const CHAT_MODELS: ChatModel[] = [
    { id: "openrouter/auto", name: "Auto (Best Available)", icon: "🤖", free: true },
    { id: "arcee-ai/trinity-large-preview:free", name: "Trinity Large Preview", icon: "🔮", free: true },
    { id: "liquid/lfm-2.5-1.2b-instruct:free", name: "LFM 2.5 1.2B (Fast)", icon: "⚡", free: true },
    { id: "qwen/qwen3-vl-30b-a3b-thinking", name: "Qwen3 VL 30B (Vision)", icon: "👁️", free: false },
    { id: "qwen/qwen3-vl-235b-a22b-thinking", name: "Qwen3 VL 235B (Vision)", icon: "🔭", free: false },
    { id: "qwen/qwen3-235b-a22b-thinking-2507", name: "Qwen3 235B (Reasoning)", icon: "🧠", free: false },
    { id: "google/gemma-3n-e2b-it:free", name: "Gemma 3n E2B", icon: "💎", free: true },
    { id: "google/gemma-3n-e4b-it:free", name: "Gemma 3n E4B", icon: "💎", free: true },
    { id: "google/gemma-3-4b-it:free", name: "Gemma 3 4B", icon: "💎", free: true },
    { id: "google/gemma-3-12b-it:free", name: "Gemma 3 12B", icon: "💎", free: true },
]

export const DEFAULT_MODEL = "openrouter/auto"

export function getModelById(id: string): ChatModel | undefined {
    return CHAT_MODELS.find((m) => m.id === id)
}
