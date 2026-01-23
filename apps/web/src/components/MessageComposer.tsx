"use client";

import { ScrapedComment } from "@/utils/constants";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { useEffect, useRef, useState } from "react";

interface ReplyComposerProps {
  selectedComment: ScrapedComment | null;
  onSend: (message: string) => void;
  onClearSelection: () => void;
  disabled?: boolean;
}

export function ReplyComposer({
  selectedComment,
  onSend,
  onClearSelection,
  disabled,
}: ReplyComposerProps) {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessage((prev) => prev + emojiData.emoji);
    textareaRef.current?.focus();
  };

  const handleSend = () => {
    if (!selectedComment || !message.trim()) return;
    onSend(message);
    setMessage("");
  };

  return (
    <div className="bg-tiktok-gray rounded-lg p-4 space-y-4">
      <h3 className="font-medium text-white">Reply Composer</h3>

      <div className="relative">
        <textarea
          ref={textareaRef}
          placeholder="Write your reply..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 bg-tiktok-dark border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-tiktok-red resize-y"
        />
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="absolute right-2 bottom-4 text-gray-400 hover:text-white transition-colors"
          title="Add emoji"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
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
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute right-0 top-full mt-2 z-10"
          >
            <EmojiPicker
              theme={Theme.DARK}
              onEmojiClick={handleEmojiClick}
              width={300}
              height={350}
              previewConfig={{ showPreview: false }}
            />
          </div>
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
            Comment: "{selectedComment.comment}"
          </p>
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={disabled || !selectedComment || !message.trim()}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
      >
        {disabled ? "Replying..." : "Send Reply"}
      </button>
    </div>
  );
}
