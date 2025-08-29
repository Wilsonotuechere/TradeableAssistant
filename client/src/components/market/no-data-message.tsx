import { BarChart3 } from "lucide-react";

interface NoDataMessageProps {
  message?: string;
}

export const NoDataMessage: React.FC<NoDataMessageProps> = ({
  message = "No chart data available",
}) => {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-2">
        <BarChart3 className="h-8 w-8 mx-auto text-cool-gray/50" />
        <p className="text-cool-gray">{message}</p>
      </div>
    </div>
  );
};
