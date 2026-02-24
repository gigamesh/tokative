import { useTheme } from "@/providers/ThemeProvider";
import { ScrapedComment } from "@/utils/constants";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { AlertTriangle, Globe, Smile, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

interface ReplyComposerProps {
  selectedComments: ScrapedComment[];
  selectedCount: number;
  onAddToQueue: (messages: string[]) => void;
  disabled?: boolean;
  replyLimitReached?: boolean;
  translationEnabled?: boolean;
  targetLanguage?: string;
  translateRepliesEnabled?: boolean;
  onTranslateRepliesToggle?: (enabled: boolean) => void;
  isTranslatingReplies?: boolean;
}

export function ReplyComposer({
  selectedComments,
  selectedCount,
  onAddToQueue,
  disabled,
  replyLimitReached,
  translationEnabled,
  targetLanguage,
  translateRepliesEnabled,
  onTranslateRepliesToggle,
  isTranslatingReplies,
}: ReplyComposerProps) {
  const [messages, setMessages] = useState<string[]>([""]);
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<number | null>(
    null,
  );
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [emojiPickerPos, setEmojiPickerPos] = useState<{ top: number; left: number } | null>(null);
  const { theme } = useTheme();

  const langDisplayNames = useMemo(
    () => new Intl.DisplayNames(["en"], { type: "language" }),
    [],
  );

  const { hasTranslatableComments, languageSummary } = useMemo(() => {
    if (!translationEnabled || !targetLanguage) {
      return { hasTranslatableComments: false, languageSummary: "" };
    }
    const attempted = selectedComments.filter((c) => c.translationAttempted);
    const counts = new Map<string, number>();
    let translatableCount = 0;
    for (const c of attempted) {
      const lang = c.detectedLanguage || "unknown";
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
      if (lang !== targetLanguage && lang !== "unknown" && lang !== "other") translatableCount++;
    }
    if (translatableCount === 0) {
      return { hasTranslatableComments: false, languageSummary: "" };
    }
    const parts: string[] = [];
    for (const [lang, count] of counts) {
      if (lang === "unknown") {
        parts.push(`${count} → unknown (no translation)`);
      } else if (lang === "other") {
        parts.push(`${count} → other (no translation)`);
      } else if (lang === targetLanguage) {
        const name = langDisplayNames.of(lang) ?? lang;
        parts.push(`${count} → ${name} (no translation)`);
      } else {
        const name = langDisplayNames.of(lang) ?? lang;
        parts.push(`${count} → ${name}`);
      }
    }
    return { hasTranslatableComments: true, languageSummary: parts.join(", ") };
  }, [selectedComments, translationEnabled, targetLanguage, langDisplayNames]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setActiveEmojiPicker(null);
      }
    };

    if (activeEmojiPicker !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeEmojiPicker]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    if (activeEmojiPicker === null) return;
    const index = activeEmojiPicker;
    setMessages((prev) => {
      const updated = [...prev];
      updated[index] = (updated[index] || "") + emojiData.emoji;
      return updated;
    });
    textareaRefs.current[index]?.focus();
  };

  const updateMessage = (index: number, value: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const addMessage = () => {
    setMessages((prev) => [...prev, ""]);
  };

  const removeMessage = (index: number) => {
    if (messages.length <= 1) return;
    setMessages((prev) => prev.filter((_, i) => i !== index));
  };

  const validMessages = messages.filter((m) => m.trim());

  const handleAddToQueue = () => {
    if (validMessages.length === 0 || selectedCount === 0) return;
    onAddToQueue(validMessages);
  };

  const allMessagesValid =
    messages.length > 1 ? messages.every((m) => m.trim()) : messages[0]?.trim();

  const canAdd =
    allMessagesValid && selectedCount > 0 && !isTranslatingReplies;

  const needsMoreVariations =
    (selectedCount > 30 && messages.length < 3) ||
    (selectedCount > 10 && messages.length < 2);

  return (
    <div className="bg-surface-elevated rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">Reply Composer</h3>
        {selectedCount > 0 && (
          <span className="text-sm bg-accent-cyan-muted-20 text-accent-cyan-text px-2 py-0.5 rounded-full">
            {selectedCount} selected
          </span>
        )}
      </div>

      <div className="space-y-2">
        {messages.map((message, index) => (
          <div key={index} className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={(el) => {
                    textareaRefs.current[index] = el;
                  }}
                  placeholder={
                    messages.length > 1
                      ? `Reply variation ${index + 1}...`
                      : "Write your reply..."
                  }
                  value={message}
                  onChange={(e) => updateMessage(index, e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-foreground-muted focus:outline-none focus:border-accent-cyan-muted resize-y text-sm min-h-[100px]"
                />
                <button
                  type="button"
                  ref={(el) => {
                    emojiButtonRefs.current[index] = el;
                  }}
                  onClick={() => {
                    if (activeEmojiPicker === index) {
                      setActiveEmojiPicker(null);
                      setEmojiPickerPos(null);
                    } else {
                      const btn = emojiButtonRefs.current[index];
                      if (btn) {
                        const rect = btn.getBoundingClientRect();
                        const pickerHeight = 400;
                        const spaceBelow = window.innerHeight - rect.bottom;
                        const top = spaceBelow >= pickerHeight + 80
                          ? rect.bottom + 8
                          : rect.top - pickerHeight - 8;
                        setEmojiPickerPos({ top, left: rect.right - 296 });
                      }
                      setActiveEmojiPicker(index);
                    }
                  }}
                  className="absolute right-2.5 bottom-2.5 text-foreground-muted hover:text-foreground transition-colors"
                  title="Add emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>
              </div>
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMessage(index)}
                  className="self-start mt-2 text-foreground-muted hover:text-red-400 transition-colors"
                  title="Remove this reply"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {needsMoreVariations && (
        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-500">
            {selectedCount > 30
              ? "You have more than 30 comments selected. Add at least 3 reply variations to make your replies look natural and avoid being flagged as spam."
              : "You have more than 10 comments selected. Add at least 2 reply variations to make your replies look natural and avoid being flagged as spam."}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addMessage}
          className="flex-1 py-1.5 text-sm text-foreground-muted hover:text-foreground border border-dashed border-border hover:border-foreground-muted rounded-lg transition-colors"
        >
          + Add Reply Variation
        </button>
        {messages.length > 1 && (
          <button
            type="button"
            onClick={() => setMessages([""])}
            className="py-1.5 px-3 text-sm text-red-400/70 hover:text-red-400 border border-dashed border-border hover:border-red-400/50 rounded-lg transition-colors"
          >
            Clear variations
          </button>
        )}
      </div>

      {translationEnabled && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => hasTranslatableComments && onTranslateRepliesToggle?.(!translateRepliesEnabled)}
            className={`flex items-center gap-2 w-full text-left text-sm ${
              !hasTranslatableComments ? "opacity-40 cursor-default" : ""
            }`}
            disabled={!hasTranslatableComments}
          >
            <Globe className="w-4 h-4 text-accent-cyan-text flex-shrink-0" />
            <span className="flex-1 text-foreground-muted">
              Translate replies to commenter&apos;s language
            </span>
            <div
              className={`w-8 h-[18px] rounded-full transition-colors flex items-center ${
                hasTranslatableComments && translateRepliesEnabled
                  ? "bg-accent-cyan-muted justify-end"
                  : "bg-border justify-start"
              }`}
            >
              <div className="w-3.5 h-3.5 bg-white rounded-full mx-0.5" />
            </div>
          </button>
          {hasTranslatableComments && translateRepliesEnabled && (
            <p className="text-xs text-foreground-muted pl-6">
              {languageSummary}
            </p>
          )}
        </div>
      )}

      {replyLimitReached && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">
            Monthly reply limit reached.{" "}
            <a href="/pricing" className="underline hover:text-red-300">
              Upgrade for more replies
            </a>
          </p>
        </div>
      )}

      <div className="relative group">
        <Button
          variant="secondary"
          fullWidth
          onClick={handleAddToQueue}
          disabled={disabled || !canAdd}
        >
          {isTranslatingReplies ? "Translating..." : "Add to Queue"}
        </Button>
      </div>

      {activeEmojiPicker !== null && emojiPickerPos &&
        createPortal(
          <div
            ref={emojiPickerRef}
            className="fixed z-50"
            style={{ top: emojiPickerPos.top, left: emojiPickerPos.left }}
          >
            <EmojiPicker
              theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
              onEmojiClick={handleEmojiClick}
              width={296}
              height={400}
              previewConfig={{ showPreview: false }}
              style={{
                "--epr-emoji-size": "20px",
                "--epr-emoji-padding": "3px",
              } as React.CSSProperties}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
