import { useTheme } from "@/providers/ThemeProvider";
import { ScrapedComment } from "@/utils/constants";
import { BulkReplyProgress } from "@tokative/shared";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { AlertTriangle, Globe, Smile, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { CompactCommentCard } from "./CompactCommentCard";
import { Spinner } from "./Spinner";

interface ReplyComposerProps {
  selectedComments: ScrapedComment[];
  selectedCount: number;
  onSend: (messages: string[]) => void;
  onClearSelection: () => void;
  onToggleComment: (commentId: string, selected: boolean) => void;
  bulkReplyProgress: BulkReplyProgress | null;
  replyStatusMessage: string | null;
  onStopBulkReply: () => void;
  onDismissProgress?: () => void;
  disabled?: boolean;
  replyBudget?: number;
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
  onSend,
  onClearSelection,
  onToggleComment,
  bulkReplyProgress,
  replyStatusMessage,
  onStopBulkReply,
  onDismissProgress,
  disabled,
  replyBudget,
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
  const [hasOverflow, setHasOverflow] = useState(false);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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
    const counts = new Map<string, number>();
    let translatableCount = 0;
    for (const c of selectedComments) {
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

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    setHasOverflow(container.scrollHeight > container.clientHeight);
  }, [selectedComments.length]);

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

  const handleSend = () => {
    if (validMessages.length === 0 || selectedCount === 0) return;
    onSend(validMessages);
  };

  const handleDismiss = () => {
    onDismissProgress?.();
    onClearSelection();
  };

  const allMessagesValid =
    messages.length > 1 ? messages.every((m) => m.trim()) : messages[0]?.trim();

  const canSend =
    allMessagesValid && selectedCount > 0 && !isTranslatingReplies;

  const needsMoreVariations =
    (selectedCount > 30 && messages.length < 3) ||
    (selectedCount > 10 && messages.length < 2);

  const isActiveBulkReply =
    bulkReplyProgress && bulkReplyProgress.status === "running";

  const isBulkReplyFinished =
    bulkReplyProgress &&
    (bulkReplyProgress.status === "complete" ||
      bulkReplyProgress.status === "stopped");

  const showBulkProgress = isActiveBulkReply;

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

      {selectedComments.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground-muted">
              Selected comments
            </span>
            {!isActiveBulkReply && !isBulkReplyFinished && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="text-xs"
              >
                Clear all
              </Button>
            )}
          </div>
          <div
            ref={scrollContainerRef}
            className={`max-h-48 space-y-1 pr-1 ${hasOverflow ? "scrollbar-visible" : "overflow-y-auto"}`}
          >
            {selectedComments.map((comment) => (
              <CompactCommentCard
                key={comment.id}
                comment={comment}
                onRemove={() => onToggleComment(comment.id, false)}
                status={bulkReplyProgress?.commentStatuses?.[comment.id]}
              />
            ))}
          </div>
        </div>
      )}

      {showBulkProgress && (
        <div className="p-3 bg-surface border border-border rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Spinner size="sm" />
              <span className="text-xs font-medium text-foreground">
                Reply Progress
              </span>
            </div>
            {bulkReplyProgress.total > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onStopBulkReply}
                className="text-xs text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
              >
                Stop
              </Button>
            )}
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-foreground-muted">
              {bulkReplyProgress.completed +
                bulkReplyProgress.failed +
                bulkReplyProgress.skipped}{" "}
              / {bulkReplyProgress.total}
            </span>
            {bulkReplyProgress.current && (
              <span className="text-foreground-muted">
                @{bulkReplyProgress.current}
              </span>
            )}
          </div>
          {replyStatusMessage && (
            <p className="text-xs text-foreground-muted">
              {replyStatusMessage}
            </p>
          )}
          <div className="w-full bg-surface-secondary rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all"
              style={{
                width: `${((bulkReplyProgress.completed + bulkReplyProgress.failed + bulkReplyProgress.skipped) / bulkReplyProgress.total) * 100}%`,
              }}
            />
          </div>
          <div className="flex gap-3 text-xs">
            <span className="text-green-600 dark:text-green-400">
              {bulkReplyProgress.completed} sent
            </span>
            {bulkReplyProgress.failed > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {bulkReplyProgress.failed} failed
              </span>
            )}
            {bulkReplyProgress.skipped > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400">
                {bulkReplyProgress.skipped} skipped
              </span>
            )}
          </div>
        </div>
      )}

      {isBulkReplyFinished && (
        <div className="p-3 bg-surface border border-border rounded-lg space-y-2">
          <div className="flex gap-3 text-xs">
            <span className="text-green-600 dark:text-green-400">
              {bulkReplyProgress.completed} sent
            </span>
            {bulkReplyProgress.failed > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {bulkReplyProgress.failed} failed
              </span>
            )}
            {bulkReplyProgress.skipped > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400">
                {bulkReplyProgress.skipped} skipped
              </span>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={handleDismiss}
          >
            Done
          </Button>
        </div>
      )}

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

      {translationEnabled && hasTranslatableComments && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => onTranslateRepliesToggle?.(!translateRepliesEnabled)}
            className="flex items-center gap-2 w-full text-left text-sm"
          >
            <Globe className="w-4 h-4 text-accent-cyan-text flex-shrink-0" />
            <span className="flex-1 text-foreground-muted">
              Translate replies to commenter&apos;s language
            </span>
            <div
              className={`w-8 h-[18px] rounded-full transition-colors flex items-center ${
                translateRepliesEnabled
                  ? "bg-accent-cyan-muted justify-end"
                  : "bg-border justify-start"
              }`}
            >
              <div className="w-3.5 h-3.5 bg-white rounded-full mx-0.5" />
            </div>
          </button>
          {translateRepliesEnabled && (
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

      {!replyLimitReached &&
        replyBudget !== undefined &&
        selectedCount > replyBudget && (
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-500">
              Only {replyBudget} {replyBudget === 1 ? "reply" : "replies"}{" "}
              remaining in your monthly limit. {selectedCount - replyBudget}{" "}
              comment{selectedCount - replyBudget === 1 ? "" : "s"} will be
              skipped.{" "}
              <a href="/pricing" className="underline hover:text-yellow-400">
                Upgrade
              </a>
            </p>
          </div>
        )}

      <div className="relative group">
        <Button
          variant="secondary"
          fullWidth
          onClick={handleSend}
          disabled={disabled || !canSend}
        >
          {isTranslatingReplies ? "Translating..." : disabled ? "Replying..." : "Reply"}
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
