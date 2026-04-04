import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Check, Loader2 } from "lucide-react";
import { useSendChatMessage, useConfirmChatAction } from "@workspace/api-client-react";
import type { ChatSuggestedAction } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggested_action?: ChatSuggestedAction | null;
  actionConfirmed?: boolean;
  actionResult?: string | null;
}

const QUICK_CHIPS = [
  { label: "Gesünder essen 🌿", message: "Ich möchte mich gesünder ernähren" },
  { label: "Stress & Ernährung 💆", message: "Wie beeinflusst Stress meine Ernährung?" },
  { label: "Einkaufsliste ergänzen 🛒", message: "Kannst du etwas zu meiner Einkaufsliste hinzufügen?" },
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function ActionButton({
  action,
  confirmed,
  actionResult,
  onConfirm,
  isLoading,
}: {
  action: ChatSuggestedAction;
  confirmed?: boolean;
  actionResult?: string | null;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  if (confirmed && actionResult) {
    return (
      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-xs">
        <Check className="w-3.5 h-3.5 shrink-0" />
        <span>{actionResult}</span>
      </div>
    );
  }

  if (confirmed) {
    return null;
  }

  return (
    <button
      onClick={onConfirm}
      disabled={isLoading}
      className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
      style={{ backgroundColor: "#E07070" }}
      data-testid="chat-action-button"
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Check className="w-3.5 h-3.5" />
      )}
      <span>{action.confirmation_text}</span>
    </button>
  );
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [confirmingIndex, setConfirmingIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendMutation = useSendChatMessage();
  const confirmMutation = useConfirmChatAction();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleConfirmAction = useCallback(
    (messageIndex: number, action: ChatSuggestedAction) => {
      setConfirmingIndex(messageIndex);
      confirmMutation.mutate(
        {
          data: {
            action_type: action.type,
            data: action.data,
          },
        },
        {
          onSuccess: (result: { success: boolean; message: string; planId?: number }) => {
            setMessages((prev) =>
              prev.map((msg, i) =>
                i === messageIndex
                  ? { ...msg, actionConfirmed: true, actionResult: result.message }
                  : msg
              )
            );
            setConfirmingIndex(null);
          },
          onError: () => {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: "Die Aktion konnte leider nicht ausgeführt werden. Bitte versuche es erneut.",
              },
            ]);
            setConfirmingIndex(null);
          },
        }
      );
    },
    [confirmMutation]
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || sendMutation.isPending) return;

      const userMessage: ChatMessage = { role: "user", content: text.trim() };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setIsTyping(true);

      sendMutation.mutate(
        {
          data: {
            message: text.trim(),
            history: newMessages.slice(-10).map((m) => ({
              role: m.role,
              content: m.content,
            })),
          },
        },
        {
          onSuccess: (data: { reply: string; suggested_action?: ChatSuggestedAction }) => {
            setIsTyping(false);
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: data.reply,
                suggested_action: data.suggested_action ?? null,
              },
            ]);
          },
          onError: () => {
            setIsTyping(false);
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  "Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.",
              },
            ]);
          },
        }
      );
    },
    [messages, sendMutation]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-4 bottom-20 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: "#E07070" }}
          aria-label="Chat öffnen"
          data-testid="chat-fab"
        >
          <MessageCircle className="w-6 h-6 text-white" />
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-background border-t border-border shadow-2xl animate-in slide-in-from-bottom duration-300"
          style={{ height: "70dvh", maxHeight: "70dvh" }}
          data-testid="chat-panel"
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0"
            style={{ backgroundColor: "#E07070" }}
          >
            <div>
              <h2 className="text-white font-semibold text-base">
                Bewusster Begleiter
              </h2>
              <p className="text-white/70 text-xs">
                Dein Ernährungs-Coach
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white p-1 rounded"
              aria-label="Chat schließen"
              data-testid="chat-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" data-testid="chat-messages">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <MessageCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground mb-1">
                  Willkommen beim Bewussten Begleiter!
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Stelle mir eine Frage oder wähle ein Thema unten aus.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                      : "mr-auto bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  {msg.content}
                </div>
                {msg.role === "assistant" && msg.suggested_action && (
                  <div className="max-w-[85%]">
                    <ActionButton
                      action={msg.suggested_action}
                      confirmed={msg.actionConfirmed}
                      actionResult={msg.actionResult}
                      onConfirm={() => handleConfirmAction(i, msg.suggested_action!)}
                      isLoading={confirmingIndex === i && confirmMutation.isPending}
                    />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="mr-auto bg-muted rounded-2xl rounded-bl-sm max-w-[85%]">
                <TypingIndicator />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 border-t border-border bg-background">
            {messages.length === 0 && (
              <div className="flex gap-2 px-4 pt-3 overflow-x-auto pb-1" data-testid="chat-chips">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => sendMessage(chip.message)}
                    className="shrink-0 px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-foreground hover:bg-muted/80 transition-colors border border-border"
                    disabled={sendMutation.isPending}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground/50 text-center pt-2 px-4">
              Chat wird nicht gespeichert
            </p>

            <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nachricht eingeben..."
                className="flex-1 px-4 py-2.5 rounded-full bg-muted text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                disabled={sendMutation.isPending}
                maxLength={2000}
                data-testid="chat-input"
              />
              <button
                type="submit"
                disabled={!input.trim() || sendMutation.isPending}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-opacity shrink-0"
                style={{ backgroundColor: "#E07070" }}
                aria-label="Nachricht senden"
                data-testid="chat-send"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
