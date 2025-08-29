import {
  Bot,
  User,
  Lightbulb,
  BarChart3,
  Newspaper,
  Brain,
  Gauge,
  Clock,
} from "lucide-react";
import type { ChatMessage } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

interface ChatMessageProps {
  message: ChatMessage;
}

export default function ChatMessageComponent({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  const getIntentIcon = () => {
    switch (message.intent) {
      case "AI_RESPONSE":
        return <BarChart3 className="h-4 w-4 text-electric" />;
      case "USER_QUERY":
        return <Newspaper className="h-4 w-4 text-neon" />;
      case "SYSTEM":
        return <Lightbulb className="h-4 w-4 text-amber" />;
      default:
        return null;
    }
  };

  const getIntentColor = () => {
    switch (message.intent) {
      case "AI_RESPONSE":
        return "bg-electric/10 text-electric border-electric/20";
      case "USER_QUERY":
        return "bg-neon/10 text-neon border-neon/20";
      case "SYSTEM":
        return "bg-amber/10 text-amber border-amber/20";
      default:
        return "bg-cool-gray/10 text-cool-gray border-cool-gray/20";
    }
  };

  return (
    <div
      className={`flex items-start space-x-3 ${
        isUser ? "justify-end" : ""
      } group`}
    >
      {!isUser && (
        <div className="w-8 h-8 bg-gradient-to-r from-electric to-neon rounded-full flex items-center justify-center flex-shrink-0 pulse-glow">
          <Bot className="text-white" size={16} />
        </div>
      )}

      <div className="space-y-2 max-w-2xl">
        {message.intent && !isUser && (
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium transition-opacity",
              getIntentColor(),
              "opacity-0 group-hover:opacity-100"
            )}
          >
            <span className="mr-1">{getIntentIcon()}</span>
            {message.intent.toLowerCase()}
          </Badge>
        )}

        <div
          className={cn(
            "rounded-2xl p-4",
            isUser
              ? "bg-electric rounded-tr-sm text-white"
              : "bg-white/10 backdrop-blur rounded-tl-sm text-cool-gray"
          )}
        >
          <p className="whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
          {!isUser && message.metadata?.ensembleDetails && (
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-cool-gray/70">
                <div className="flex items-center gap-2">
                  <Brain size={12} className="text-electric" />
                  <span>AI Ensemble Analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <Gauge size={12} className="text-neon" />
                  <span>
                    Consensus:{" "}
                    {(
                      message.metadata.ensembleDetails.consensusScore * 100
                    ).toFixed(0)}
                    %
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-purple-400" />
                  <span>
                    {message.metadata.ensembleDetails.processingTime}ms
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                {message.metadata.ensembleDetails.modelsUsed.map(
                  (model: any) => (
                    <div key={model.name} className="space-y-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center justify-between text-cool-gray/60 hover:text-cool-gray/80 transition-colors">
                              <span className="text-[10px] uppercase tracking-wider">
                                {model.name}
                              </span>
                              <span className="text-[10px]">
                                {(model.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">
                              {model.strengths.join(", ")}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Progress
                        value={model.confidence * 100}
                        className="h-1 bg-white/5"
                        indicatorClassName={
                          model.confidence > 0.8
                            ? "bg-emerald"
                            : model.confidence > 0.6
                            ? "bg-electric"
                            : "bg-amber"
                        }
                      />
                    </div>
                  )
                )}
              </div>
            </div>
          )}
          {!isUser && message.timestamp && (
            <time className="block mt-2 text-xs opacity-50">
              {new Date(message.timestamp).toLocaleTimeString()}
            </time>
          )}
        </div>
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
  return classes.filter(Boolean).join(" ");
}
