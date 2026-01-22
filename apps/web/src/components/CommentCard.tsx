"use client";

import { ScrapedUser } from "@/utils/constants";
import { useEffect, useRef, useState } from "react";

interface UserCardProps {
  user: ScrapedUser;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onRemove: () => void;
  onSendMessage: () => void;
  onReplyComment: () => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function CommentCard({
  user,
  selected,
  onSelect,
  onRemove,
  onSendMessage,
  onReplyComment,
}: UserCardProps) {
  const [isCommentExpanded, setIsCommentExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const commentRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = commentRef.current;
    if (el) {
      setIsTruncated(el.scrollHeight > el.clientHeight);
    }
  }, [user.comment]);

  const messageStatusColor = user.messageSent
    ? "text-green-400"
    : user.messageError
      ? "text-red-400"
      : "text-gray-400";

  const messageStatusText = user.messageSent
    ? "DM sent"
    : user.messageError
      ? "DM failed"
      : "";

  const replyStatusColor = user.replySent
    ? "text-green-400"
    : user.replyError
      ? "text-red-400"
      : "text-gray-400";

  const replyStatusText = user.replySent
    ? "Replied"
    : user.replyError
      ? "Reply failed"
      : "";

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

        {user.videoThumbnailUrl && (
          <a
            href={user.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            <img
              src={user.videoThumbnailUrl}
              alt="Video thumbnail"
              className="w-16 h-20 object-cover rounded bg-gray-800"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </a>
        )}

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
            {user.commentTimestamp && (
              <span className="text-xs text-gray-500">
                {formatRelativeTime(user.commentTimestamp)}
              </span>
            )}
            {messageStatusText && (
              <span className={`text-xs ${messageStatusColor}`}>
                {messageStatusText}
              </span>
            )}
            {replyStatusText && (
              <span className={`text-xs ${replyStatusColor}`}>
                {replyStatusText}
              </span>
            )}
          </div>

          <p
            ref={commentRef}
            className={`text-sm text-gray-400 ${isCommentExpanded ? "" : "line-clamp-2"}`}
          >
            {user.comment}
          </p>
          {(isTruncated || isCommentExpanded) && (
            <button
              onClick={() => setIsCommentExpanded(!isCommentExpanded)}
              className="text-xs text-blue-400 hover:underline mb-2"
            >
              {isCommentExpanded ? "Show less" : "Show more"}
            </button>
          )}

          {user.sentAt && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Sent {formatRelativeTime(user.sentAt)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!user.replySent && user.videoUrl && (
            <button
              onClick={onReplyComment}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              Reply
            </button>
          )}
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
