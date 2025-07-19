import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

interface RelativeTimeProps {
  timestamp: string;
}

export default function RelativeTime({ timestamp }: RelativeTimeProps) {
  const [timeString, setTimeString] = useState<string>("");

  useEffect(() => {
    setTimeString(formatDistanceToNow(new Date(timestamp), { addSuffix: true }));
  }, [timestamp]);

  // Return nothing during SSR
  if (!timeString) {
    return null;
  }

  return <span>{timeString}</span>;
}