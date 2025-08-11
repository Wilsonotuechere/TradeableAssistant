import { Bot, User } from "lucide-react";
import type { ChatMessage } from "@shared/schema";

interface ChatMessageProps {
  message: ChatMessage;
}

export default function ChatMessageComponent({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex items-start space-x-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 bg-gradient-to-r from-electric to-neon rounded-full flex items-center justify-center flex-shrink-0 pulse-glow">
          <Bot className="text-white" size={16} />
        </div>
      )}
      
      <div
        className={cn(
          "rounded-2xl p-4 max-w-2xl",
          isUser 
            ? "bg-electric rounded-tr-sm" 
            : "bg-white/10 backdrop-blur rounded-tl-sm"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && message.content.includes("This is information, not financial advice") && (
          <p className="text-sm text-cool-gray italic mt-2">
            This is information, not financial advice.
          </p>
        )}
      </div>
      
      {isUser && (
        <div className="w-8 h-8 bg-cool-gray/20 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="text-cool-gray" size={16} />
        </div>
      )}
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
