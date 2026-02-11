import { Button } from "./Button";
import { Modal } from "./Modal";
import { IgnoreListEntry } from "@/utils/constants";
import { X } from "lucide-react";
import { useState } from "react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  commentLimitInput: string;
  onCommentLimitChange: (value: string) => void;
  onCommentLimitBlur: () => void;
  ignoreList: IgnoreListEntry[];
  onAddToIgnoreList: (text: string) => void;
  onRemoveFromIgnoreList: (text: string) => void;
  hideOwnReplies: boolean;
  onHideOwnRepliesChange: (value: boolean) => void;
  deleteMissingComments: boolean | null;
  onDeleteMissingCommentsChange: (value: boolean) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  commentLimitInput,
  onCommentLimitChange,
  onCommentLimitBlur,
  ignoreList,
  onAddToIgnoreList,
  onRemoveFromIgnoreList,
  hideOwnReplies,
  onHideOwnRepliesChange,
  deleteMissingComments,
  onDeleteMissingCommentsChange,
}: SettingsModalProps) {
  const [newIgnoreText, setNewIgnoreText] = useState("");

  const handleAddIgnoreText = () => {
    const trimmed = newIgnoreText.trim();
    if (trimmed && !ignoreList.some((entry) => entry.text === trimmed)) {
      onAddToIgnoreList(trimmed);
      setNewIgnoreText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddIgnoreText();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-medium text-foreground">Settings</h2>
        <button
          onClick={onClose}
          className="text-foreground-muted hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm text-foreground-muted mb-2">
            Comment Limit
          </label>
          <input
            type="number"
            value={commentLimitInput}
            onChange={(e) => onCommentLimitChange(e.target.value)}
            onBlur={onCommentLimitBlur}
            min={1}
            className="w-24 px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent-cyan-muted"
          />
          <p className="text-xs text-foreground-muted mt-1">
            Max comments per collection
          </p>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hideOwnReplies}
              onChange={(e) => onHideOwnRepliesChange(e.target.checked)}
              className="w-5 h-5 rounded border-border bg-surface-secondary text-accent-cyan-solid focus:ring-accent-cyan-solid"
            />
            <div>
              <span className="text-sm text-foreground">
                Hide your replies
              </span>
              <p className="text-xs text-foreground-muted">
                Don&apos;t show comments sent via this app (also hides the
                comment being replied to)
              </p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteMissingComments === true}
              onChange={(e) =>
                onDeleteMissingCommentsChange(e.target.checked)
              }
              className="w-5 h-5 rounded border-border bg-surface-secondary text-accent-cyan-solid focus:ring-accent-cyan-solid"
            />
            <div>
              <span className="text-sm text-foreground">
                Auto-delete missing comments
              </span>
              <p className="text-xs text-foreground-muted">
                Automatically remove comments from your list during bulk reply
                if they no longer exist on TikTok
              </p>
            </div>
          </label>
        </div>

        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">
            Ignore List
          </h3>
          <p className="text-xs text-foreground-muted mb-3">
            Comments matching these texts will be automatically filtered out
            when collecting.
          </p>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newIgnoreText}
              onChange={(e) => setNewIgnoreText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter text to ignore..."
              className="flex-1 px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:border-accent-cyan-muted"
            />
            <Button
              variant="secondary"
              onClick={handleAddIgnoreText}
              disabled={!newIgnoreText.trim()}
            >
              Add
            </Button>
          </div>

          {ignoreList.length === 0 ? (
            <p className="text-sm text-foreground-muted italic">
              No ignored texts yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {ignoreList.map((entry) => (
                <div
                  key={entry.text}
                  className="flex items-start gap-3 p-3 bg-surface-secondary rounded-lg group"
                >
                  <p className="flex-1 text-sm text-foreground-secondary break-words">
                    &ldquo;
                    {entry.text.length > 150
                      ? entry.text.slice(0, 150) + "..."
                      : entry.text}
                    &rdquo;
                  </p>
                  <button
                    onClick={() => onRemoveFromIgnoreList(entry.text)}
                    className="text-foreground-muted hover:text-red-400 transition-colors flex-shrink-0"
                    title="Remove from ignore list"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
