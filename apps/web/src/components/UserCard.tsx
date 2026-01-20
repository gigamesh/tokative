"use client";

import { ScrapedUser } from "@/utils/constants";

interface UserCardProps {
  user: ScrapedUser;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onRemove: () => void;
  onSendMessage: () => void;
}

export function UserCard({
  user,
  selected,
  onSelect,
  onRemove,
  onSendMessage,
}: UserCardProps) {
  const statusColor = user.messageSent
    ? "text-green-400"
    : user.messageError
    ? "text-red-400"
    : "text-gray-400";

  const statusText = user.messageSent
    ? "Sent"
    : user.messageError
    ? "Failed"
    : "Not sent";

  return (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        selected
          ? "border-tiktok-red bg-tiktok-red/10"
          : "border-gray-700 bg-tiktok-gray hover:border-gray-600"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-700 text-tiktok-red focus:ring-tiktok-red"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <a
              href={user.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white hover:text-tiktok-red transition-colors"
            >
              @{user.handle}
            </a>
            <span className={`text-xs ${statusColor}`}>{statusText}</span>
          </div>

          <p className="text-sm text-gray-400 truncate mb-2">{user.comment}</p>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>
              Scraped {new Date(user.scrapedAt).toLocaleDateString()}
            </span>
            {user.sentAt && (
              <span>• Sent {new Date(user.sentAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {!user.messageSent && (
            <button
              onClick={onSendMessage}
              className="px-3 py-1.5 text-sm bg-tiktok-red hover:bg-tiktok-red/80 text-white rounded transition-colors"
            >
              Message
            </button>
          )}
          <button
            onClick={onRemove}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
