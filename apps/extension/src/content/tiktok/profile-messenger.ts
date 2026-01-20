import { ScrapedUser, MessageType, SendProgress } from "../../types";
import { humanDelay, humanDelayWithJitter, humanClick, humanType } from "../../utils/dom";
import { SELECTORS, waitForSelector } from "./selectors";

export async function sendMessageToUser(
  user: ScrapedUser,
  message: string
): Promise<void> {
  sendProgress(user.id, "opening", "Looking for message button...");

  await humanDelayWithJitter("short");

  const messageBtn = await waitForSelector<HTMLElement>(SELECTORS.messageButton, {
    timeout: 10000,
  });

  if (!messageBtn) {
    throw new Error("Could not find message button on profile");
  }

  sendProgress(user.id, "opening", "Opening messages...");
  await humanClick(messageBtn);

  await humanDelayWithJitter("long");

  sendProgress(user.id, "typing", "Waiting for message input...");

  const input = await waitForSelector<HTMLElement>(SELECTORS.messageInput, {
    timeout: 10000,
  });

  if (!input) {
    throw new Error("Could not find message input");
  }

  sendProgress(user.id, "typing", "Typing message...");

  input.focus();
  await humanDelay("medium");

  await humanType(message);

  await humanDelayWithJitter("medium");

  sendProgress(user.id, "sending", "Sending message...");

  input.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  }));

  await humanDelayWithJitter("long");

  sendProgress(user.id, "complete", "Message sent!");
}

function sendProgress(
  userId: string,
  status: SendProgress["status"],
  message: string
): void {
  chrome.runtime.sendMessage({
    type: MessageType.SEND_MESSAGE_PROGRESS,
    payload: { userId, status, message },
  });
}
