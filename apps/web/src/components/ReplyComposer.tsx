
import { ScrapedComment } from "@/utils/constants";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { useEffect, useRef, useState } from "react";

interface ReplyComposerProps {
  selectedComment: ScrapedComment | null;
  selectedComments: ScrapedComment[];
  selectedCount: number;
  onSend: (message: string) => void;
  onBulkSend: (messages: string[]) => void;
  onClearSelection: () => void;
  disabled?: boolean;
}

export function ReplyComposer({
  selectedComment,
  selectedComments,
  selectedCount,
  onSend,
  onBulkSend,
  onClearSelection,
  disabled,
}: ReplyComposerProps) {
  const [messages, setMessages] = useState<string[]>([""]);
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<number | null>(null);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

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

  const handleSend = () => {
    if (validMessages.length === 0) return;

    if (selectedComment) {
      // Single reply to the selected comment
      onSend(validMessages[0]);
      setMessages([""]);
    } else if (selectedCount > 0) {
      // Bulk reply to checked comments
      onBulkSend(validMessages);
    }
  };

  const allMessagesValid = messages.length > 1
    ? messages.every(m => m.trim())
    : messages[0]?.trim();

  const canSend = allMessagesValid && (selectedComment || selectedCount > 0);

  return (
    <div className="bg-tiktok-gray rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-white">Reply Composer</h3>
        {selectedCount > 0 && (
          <span className="text-sm bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
            {selectedCount} selected
          </span>
        )}
      </div>

      {selectedComment && (
        <div className="p-3 bg-tiktok-dark border border-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-400">
              Replying to @{selectedComment.handle}
            </span>
            <button
              onClick={onClearSelection}
              className="text-xs text-gray-500 hover:text-white"
            >
              Clear
            </button>
          </div>
          <p className="text-xs text-gray-500 truncate">
            "{selectedComment.comment}"
          </p>
        </div>
      )}

      {!selectedComment && selectedComments.length > 0 && (
        <div className="relative mt-1 ml-1">
          {selectedComments[1] && (
            <div className="absolute -top-1 -left-1 right-1 bottom-1 p-2 bg-tiktok-dark border border-gray-600 rounded-lg" />
          )}
          <div className="relative p-3 bg-tiktok-dark border border-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400">
                Replying to @{selectedComments[0].handle}
              </span>
              <button onClick={onClearSelection} className="text-xs text-gray-500 hover:text-white">
                Clear
              </button>
            </div>
            <p className="text-xs text-gray-500 truncate">"{selectedComments[0].comment}"</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {messages.map((message, index) => (
          <div key={index} className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={(el) => { textareaRefs.current[index] = el; }}
                  placeholder={messages.length > 1 ? `Reply variation ${index + 1}...` : "Write your reply..."}
                  value={message}
                  onChange={(e) => updateMessage(index, e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-tiktok-dark border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y text-sm min-h-[100px]"
                />
                <button
                  type="button"
                  onClick={() => setActiveEmojiPicker(activeEmojiPicker === index ? null : index)}
                  className="absolute right-2.5 bottom-2.5 text-gray-400 hover:text-white transition-colors"
                  title="Add emoji"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </button>
                {activeEmojiPicker === index && (
                  <div
                    ref={emojiPickerRef}
                    className="absolute right-0 top-full mt-2 z-10"
                  >
                    <EmojiPicker
                      theme={Theme.DARK}
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
                  className="self-start mt-2 text-gray-500 hover:text-red-400 transition-colors"
                  title="Remove this reply"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addMessage}
        className="w-full py-1.5 text-sm text-gray-400 hover:text-white border border-dashed border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
      >
        + Add Reply Variation
      </button>

      <button
        onClick={handleSend}
        disabled={disabled || !canSend}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors text-sm"
      >
        {disabled ? "Replying..." : "Reply"}
      </button>
    </div>
  );
}
