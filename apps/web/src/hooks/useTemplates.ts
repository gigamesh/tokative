"use client";

import { useState, useCallback } from "react";
import { bridge } from "@/utils/extension-bridge";
import { MessageType, MessageTemplate } from "@/utils/constants";

export function useTemplates(initialTemplates: MessageTemplate[] = []) {
  const [templates, setTemplates] = useState<MessageTemplate[]>(initialTemplates);

  const saveTemplate = useCallback(async (template: MessageTemplate) => {
    if (!bridge) return;

    bridge.send(MessageType.SAVE_TEMPLATE, { template });

    setTemplates((prev) => {
      const index = prev.findIndex((t) => t.id === template.id);
      if (index !== -1) {
        const updated = [...prev];
        updated[index] = template;
        return updated;
      }
      return [...prev, template];
    });
  }, []);

  const deleteTemplate = useCallback(async (templateId: string) => {
    if (!bridge) return;

    bridge.send(MessageType.DELETE_TEMPLATE, { templateId });
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }, []);

  const createTemplate = useCallback(
    (name: string, content: string) => {
      const template: MessageTemplate = {
        id: `template-${Date.now()}`,
        name,
        content,
      };
      saveTemplate(template);
      return template;
    },
    [saveTemplate]
  );

  const renderTemplate = useCallback(
    (
      templateContent: string,
      user: { handle: string; comment: string }
    ): string => {
      return templateContent
        .replace(/\{\{handle\}\}/g, user.handle)
        .replace(/\{\{comment\}\}/g, user.comment);
    },
    []
  );

  return {
    templates,
    setTemplates,
    saveTemplate,
    deleteTemplate,
    createTemplate,
    renderTemplate,
  };
}
