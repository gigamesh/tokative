
import { useState } from "react";
import { IgnoreListEntry } from "@/utils/constants";

interface SettingsTabProps {
  postLimitInput: string;
  commentLimitInput: string;
  onPostLimitChange: (value: string) => void;
  onCommentLimitChange: (value: string) => void;
  onPostLimitBlur: () => void;
  onCommentLimitBlur: () => void;
  ignoreList: IgnoreListEntry[];
  onAddToIgnoreList: (text: string) => void;
  onRemoveFromIgnoreList: (text: string) => void;
}

export function SettingsTab({
  postLimitInput,
  commentLimitInput,
  onPostLimitChange,
  onCommentLimitChange,
  onPostLimitBlur,
  onCommentLimitBlur,
  ignoreList,
  onAddToIgnoreList,
  onRemoveFromIgnoreList,
}: SettingsTabProps) {
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
    <div className="bg-tiktok-gray rounded-lg p-6 space-y-8">
      <div>
        <h2 className="text-lg font-medium text-white mb-4">Scraping Limits</h2>
        <div className="flex gap-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Post Limit
            </label>
            <input
              type="number"
              value={postLimitInput}
              onChange={(e) => onPostLimitChange(e.target.value)}
              onBlur={onPostLimitBlur}
              min={1}
              className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-tiktok-red"
            />
            <p className="text-xs text-gray-500 mt-1">
              Max posts to scrape from profile
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Comment Limit
            </label>
            <input
              type="number"
              value={commentLimitInput}
              onChange={(e) => onCommentLimitChange(e.target.value)}
              onBlur={onCommentLimitBlur}
              min={1}
              className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-tiktok-red"
            />
            <p className="text-xs text-gray-500 mt-1">
              Max comments to scrape total
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-white mb-4">Ignore List</h2>
        <p className="text-sm text-gray-400 mb-4">
          Comments matching these texts will be automatically filtered out when
          scraping.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newIgnoreText}
            onChange={(e) => setNewIgnoreText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter text to ignore..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-tiktok-red"
          />
          <button
            onClick={handleAddIgnoreText}
            disabled={!newIgnoreText.trim()}
            className="px-4 py-2 text-sm bg-tiktok-red hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
          >
            Add
          </button>
        </div>

        {ignoreList.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No ignored texts yet.
          </p>
        ) : (
          <div className="space-y-2">
            {ignoreList.map((entry) => (
              <div
                key={entry.text}
                className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg group"
              >
                <p className="flex-1 text-sm text-gray-300 break-words">
                  &ldquo;
                  {entry.text.length > 150
                    ? entry.text.slice(0, 150) + "..."
                    : entry.text}
                  &rdquo;
                </p>
                <button
                  onClick={() => onRemoveFromIgnoreList(entry.text)}
                  className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove from ignore list"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
