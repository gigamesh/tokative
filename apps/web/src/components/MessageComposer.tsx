"use client";

import { useState } from "react";
import { ScrapedUser } from "@/utils/constants";

type ComposerMode = "message" | "reply";

interface MessageComposerProps {
  selectedUser: ScrapedUser | null;
  mode: ComposerMode;
  onSend: (message: string) => void;
  onClearSelection: () => void;
  disabled?: boolean;
}

export function MessageComposer({
  selectedUser,
  mode,
  onSend,
  onClearSelection,
  disabled,
}: MessageComposerProps) {
  const isReplyMode = mode === "reply";
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!selectedUser || !message.trim()) return;
    onSend(message);
    setMessage("");
  };

  return (
    <div className="bg-tiktok-gray rounded-lg p-4 space-y-4">
      <h3 className="font-medium text-white">
        {isReplyMode ? "Reply to Comment" : "Send Message"}
      </h3>

      <div>
        <textarea
          placeholder={isReplyMode ? "Write your reply..." : "Write your message..."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-tiktok-dark border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-tiktok-red resize-none"
        />
      </div>

      {selectedUser && (
        <div className="p-3 bg-tiktok-dark border border-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-400">
              {isReplyMode ? "Replying to" : "Sending to"} @{selectedUser.handle}
            </span>
            <button
              onClick={onClearSelection}
              className="text-xs text-gray-500 hover:text-white"
            >
              Clear
            </button>
          </div>
          {isReplyMode && (
            <p className="text-xs text-gray-500 truncate">
              Comment: "{selectedUser.comment}"
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={disabled || !selectedUser || !message.trim()}
        className={`w-full px-4 py-2 ${
          isReplyMode
            ? "bg-blue-600 hover:bg-blue-500"
            : "bg-tiktok-red hover:bg-tiktok-red/80"
        } disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors`}
      >
        {disabled
          ? isReplyMode
            ? "Replying..."
            : "Sending..."
          : isReplyMode
          ? "Send Reply"
          : "Send Message"}
      </button>
    </div>
  );
}
