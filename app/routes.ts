import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("events", "routes/events.tsx"),
  route("events/:sessionId", "routes/events.$sessionId.tsx"),
] satisfies RouteConfig;
