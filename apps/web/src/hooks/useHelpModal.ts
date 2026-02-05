"use client";

import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/utils/constants";
import { getStorageBoolean, setStorageBoolean } from "@/utils/localStorage";

export function useHelpModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeenHelp, setHasSeenHelp] = useState<boolean | null>(null);

  useEffect(() => {
    setHasSeenHelp(getStorageBoolean(STORAGE_KEYS.HELP_SEEN, false));
  }, []);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setHasSeenHelp(true);
    setStorageBoolean(STORAGE_KEYS.HELP_SEEN, true);
  }, []);

  return {
    isOpen,
    hasSeenHelp,
    openModal,
    closeModal,
  };
}
