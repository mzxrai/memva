import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("archived", "routes/archived.tsx"),
  route("sessions/:sessionId", "routes/sessions.$sessionId.tsx"),
  route("api/session/:sessionId", "routes/api.session.$sessionId.ts"),
  route("api/session/:sessionId/status", "routes/api.session.$sessionId.status.tsx"),
  route("api/sessions/:sessionId/stop", "routes/api.sessions.$sessionId.stop.tsx"),
  route("api/sessions/:sessionId/events", "routes/api.sessions.$sessionId.events.ts"),
  route("api/sessions/homepage", "routes/api.sessions.homepage.tsx"),
  route("api/sessions/archived", "routes/api.sessions.archived.tsx"),
  route("api/claude-code/:sessionId", "routes/api.claude-code.$sessionId.tsx"),
  route("api/jobs", "routes/api.jobs.tsx"),
  route("api/jobs/:jobId", "routes/api.jobs.$jobId.tsx"),
  route("api/filesystem", "routes/api.filesystem.tsx"),
  route("api/settings", "routes/api.settings.tsx"),
  route("api/session/:sessionId/settings", "routes/api.session.$sessionId.settings.tsx"),
  route("api/permissions", "routes/api.permissions.tsx"),
  route("api/permissions/:id", "routes/api.permissions.$id.tsx"),
] satisfies RouteConfig;
