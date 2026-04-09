import { createStore } from "solid-js/store";
import { Message } from "../bindings/fastslack/shared";

interface ChatCache {
  [channelID: string]: {
    messages: Message[];
    lastScroll: number;
    hasLoaded: boolean;
    nextCursor: string | null;
  };
}

export const [chatStore, setChatStore] = createStore<ChatCache>({});

export const updateChannelCache = (
  channelID: string,
  data: Partial<ChatCache[string]>,
) => {
  setChatStore(channelID, (prev) => ({
    messages: prev?.messages || [],
    lastScroll: prev?.lastScroll || 0,
    hasLoaded: prev?.hasLoaded || false,
    ...data,
  }));
};
