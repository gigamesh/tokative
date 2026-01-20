"use client";

import { useState, useMemo } from "react";
import { MessageTemplate, ScrapedUser } from "@/utils/constants";

interface MessageComposerProps {
  templates: MessageTemplate[];
  selectedUser: ScrapedUser | null;
  onSend: (message: string) => void;
  onSaveTemplate: (template: MessageTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  disabled?: boolean;
}

export function MessageComposer({
  templates,
  selectedUser,
  onSend,
  onSaveTemplate,
  onDeleteTemplate,
  disabled,
}: MessageComposerProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates[0]?.id || ""
  );
  const [customMessage, setCustomMessage] = useState("");
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const messageContent = customMessage || selectedTemplate?.content || "";

  const preview = useMemo(() => {
    if (!selectedUser) return messageContent;
    return messageContent
      .replace(/\{\{handle\}\}/g, selectedUser.handle)
      .replace(/\{\{comment\}\}/g, selectedUser.comment);
  }, [messageContent, selectedUser]);

  const handleSend = () => {
    if (!selectedUser || !preview.trim()) return;
    onSend(preview);
    setCustomMessage("");
  };

  const handleSaveTemplate = () => {
    if (!editName.trim() || !editContent.trim()) return;

    const template: MessageTemplate = {
      id: isEditingTemplate && selectedTemplate ? selectedTemplate.id : `template-${Date.now()}`,
      name: editName,
      content: editContent,
    };

    onSaveTemplate(template);
    setIsEditingTemplate(false);
    setEditName("");
    setEditContent("");
  };

  const startEditTemplate = () => {
    if (selectedTemplate) {
      setEditName(selectedTemplate.name);
      setEditContent(selectedTemplate.content);
      setIsEditingTemplate(true);
    }
  };

  const startNewTemplate = () => {
    setEditName("");
    setEditContent("");
    setIsEditingTemplate(true);
  };

  if (isEditingTemplate) {
    return (
      <div className="bg-tiktok-gray rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-white">
          {selectedTemplate && editName === selectedTemplate.name
            ? "Edit Template"
            : "New Template"}
        </h3>

        <input
          type="text"
          placeholder="Template name"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full px-3 py-2 bg-tiktok-dark border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-tiktok-red"
        />

        <div>
          <textarea
            placeholder="Message content..."
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 bg-tiktok-dark border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-tiktok-red resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use {"{{handle}}"} for username and {"{{comment}}"} for their
            comment
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSaveTemplate}
            disabled={!editName.trim() || !editContent.trim()}
            className="px-4 py-2 bg-tiktok-red hover:bg-tiktok-red/80 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
          >
            Save Template
          </button>
          <button
            onClick={() => setIsEditingTemplate(false)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-tiktok-gray rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-white">Message Composer</h3>
        <div className="flex gap-2">
          <button
            onClick={startNewTemplate}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            + New Template
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <select
          value={selectedTemplateId}
          onChange={(e) => {
            setSelectedTemplateId(e.target.value);
            setCustomMessage("");
          }}
          className="flex-1 px-3 py-2 bg-tiktok-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:border-tiktok-red"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>

        {selectedTemplate && !selectedTemplate.isDefault && (
          <>
            <button
              onClick={startEditTemplate}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => onDeleteTemplate(selectedTemplate.id)}
              className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
            >
              Delete
            </button>
          </>
        )}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Custom message (or edit template)
        </label>
        <textarea
          placeholder="Leave empty to use template..."
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-tiktok-dark border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-tiktok-red resize-none"
        />
      </div>

      {selectedUser && (
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Preview for @{selectedUser.handle}
          </label>
          <div className="p-3 bg-tiktok-dark border border-gray-700 rounded-lg text-sm text-gray-300 whitespace-pre-wrap">
            {preview}
          </div>
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={disabled || !selectedUser || !preview.trim()}
        className="w-full px-4 py-2 bg-tiktok-red hover:bg-tiktok-red/80 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
      >
        {disabled ? "Sending..." : "Send Message"}
      </button>
    </div>
  );
}
