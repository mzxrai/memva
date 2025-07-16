import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("sessions/:sessionId", "routes/sessions.$sessionId.tsx"),
  route("events", "routes/events.tsx"),
  route("events/:sessionId", "routes/events.$sessionId.tsx"),
  route("api/claude-code/:sessionId", "routes/api.claude-code.$sessionId.tsx"),
  route("api/jobs", "routes/api.jobs.tsx"),
  route("api/jobs/:jobId", "routes/api.jobs.$jobId.tsx"),
] satisfies RouteConfig;
