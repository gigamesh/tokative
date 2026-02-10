import { useTheme } from "@/providers/ThemeProvider";
import { ScrapedComment } from "@/utils/constants";
import { BulkReplyProgress } from "@tokative/shared";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { AlertTriangle, Smile, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  disabled?: boolean;
  replyBudget?: number;
  replyLimitReached?: boolean;
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
  disabled,
  replyBudget,
  replyLimitReached,
}: ReplyComposerProps) {
  const [messages, setMessages] = useState<string[]>([""]);
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<number | null>(
    null,
  );
  const [hasOverflow, setHasOverflow] = useState(false);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

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

  const allMessagesValid =
    messages.length > 1 ? messages.every((m) => m.trim()) : messages[0]?.trim();

  const hasVariationMismatch =
    messages.length > 1 && selectedCount < messages.length;

  const canSend =
    allMessagesValid &&
    selectedCount > 0 &&
    !hasVariationMismatch;

  const needsMoreVariations =
    (selectedCount > 30 && messages.length < 3) ||
    (selectedCount > 10 && messages.length < 2);

  const showBulkProgress = bulkReplyProgress && bulkReplyProgress.status === "running";

  return (
    <div className="bg-surface-elevated rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">Reply Composer</h3>
        {selectedCount > 0 && (
          <span className="text-sm bg-accent-cyan-muted/20 text-accent-cyan-text px-2 py-0.5 rounded-full">
            {selectedCount} selected
          </span>
        )}
      </div>

      {selectedComments.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground-muted">Selected comments</span>
            <Button variant="ghost" size="sm" onClick={onClearSelection} className="text-xs">
              Clear all
            </Button>
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
              <span className="text-xs font-medium text-foreground">Reply Progress</span>
            </div>
            {bulkReplyProgress.total > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onStopBulkReply}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Stop
              </Button>
            )}
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-foreground-muted">
              {bulkReplyProgress.completed + bulkReplyProgress.failed + bulkReplyProgress.skipped} / {bulkReplyProgress.total}
            </span>
            {bulkReplyProgress.current && (
              <span className="text-foreground-muted">@{bulkReplyProgress.current}</span>
            )}
          </div>
          {replyStatusMessage && (
            <p className="text-xs text-foreground-muted">{replyStatusMessage}</p>
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
            <span className="text-green-400">{bulkReplyProgress.completed} sent</span>
            {bulkReplyProgress.failed > 0 && (
              <span className="text-red-400">{bulkReplyProgress.failed} failed</span>
            )}
            {bulkReplyProgress.skipped > 0 && (
              <span className="text-yellow-400">{bulkReplyProgress.skipped} skipped</span>
            )}
          </div>
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
                  onClick={() =>
                    setActiveEmojiPicker(
                      activeEmojiPicker === index ? null : index,
                    )
                  }
                  className="absolute right-2.5 bottom-2.5 text-foreground-muted hover:text-foreground transition-colors"
                  title="Add emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>
                {activeEmojiPicker === index && (
                  <div
                    ref={emojiPickerRef}
                    className="absolute right-0 top-full mt-2 z-10"
                  >
                    <EmojiPicker
                      theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
                      onEmojiClick={handleEmojiClick}
                      width={280}
                      height={320}
                      previewConfig={{ showPreview: false }}
                    />
                  </div>
                )}
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

      <button
        type="button"
        onClick={addMessage}
        className="w-full py-1.5 text-sm text-foreground-muted hover:text-foreground border border-dashed border-border hover:border-foreground-muted rounded-lg transition-colors"
      >
        + Add Reply Variation
      </button>

      {replyLimitReached && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">
            Monthly reply limit reached. Upgrade for more replies.
          </p>
        </div>
      )}

      {!replyLimitReached && replyBudget !== undefined && selectedCount > replyBudget && (
        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-500">
            Only {replyBudget} {replyBudget === 1 ? "reply" : "replies"} remaining. {selectedCount - replyBudget} comment{selectedCount - replyBudget === 1 ? "" : "s"} will be skipped.
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
          {disabled ? "Replying..." : "Reply"}
        </Button>
        {hasVariationMismatch && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface-elevated text-foreground-secondary text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Select at least {messages.length} comments or remove reply
            variations
          </div>
        )}
      </div>
    </div>
  );
}
