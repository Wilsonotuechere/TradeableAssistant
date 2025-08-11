import { apiRequest } from "./queryClient";

export const api = {
  // Market data
  getMarketData: async () => {
    const response = await apiRequest('GET', '/api/market');
    return response.json();
  },

  // News and sentiment
  getNews: async () => {
    const response = await apiRequest('GET', '/api/news');
    return response.json();
  },

  // Chat
  sendMessage: async (message: string, conversationId?: string) => {
    const response = await apiRequest('POST', '/api/chat', { message, conversationId });
    return response.json();
  },

  // Chat history
  getChatHistory: async () => {
    const response = await apiRequest('GET', '/api/chat/history');
    return response.json();
  },

  saveChatHistory: async (chatData: any) => {
    const response = await apiRequest('POST', '/api/chat/history', chatData);
    return response.json();
  },

  clearChatHistory: async () => {
    const response = await apiRequest('DELETE', '/api/chat/history');
    return response.json();
  }
};
