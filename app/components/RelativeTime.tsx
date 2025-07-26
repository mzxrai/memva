import { formatDistanceToNow } from "date-fns";
import { memo, useEffect, useState } from "react";

interface RelativeTimeProps {
  timestamp: string;
}

const RelativeTime = memo(function RelativeTime({ timestamp }: RelativeTimeProps) {
  const [timeString, setTimeString] = useState<string>("");

  useEffect(() => {
    // Only update if timestamp actually changed
    const formatted = formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    setTimeString(formatted);
  }, [timestamp]);

  // Return nothing during SSR
  if (!timeString) {
    return null;
  }

  return <span>{timeString}</span>;
});

export default RelativeTime;