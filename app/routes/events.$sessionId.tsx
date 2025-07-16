import type { Route } from "./+types/events.$sessionId"
import { Link, useLoaderData } from "react-router"
import { getEventsForClaudeSession } from '../db/events.service'

export async function loader({ params }: Route.LoaderArgs) {
  const sessionId = params.sessionId
  const sessionEvents = await getEventsForClaudeSession(sessionId)
  
  return { sessionEvents, sessionId }
}

export default function SessionEvents() {
  const { sessionEvents, sessionId } = useLoaderData<typeof loader>()

  if (sessionEvents.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4">Session Not Found</h1>
        <Link to="/events" className="text-blue-600 hover:underline">
          ← Back to all sessions
        </Link>
      </div>
    )
  }

  const firstEvent = sessionEvents[0]
  const lastEvent = sessionEvents[sessionEvents.length - 1]

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <Link to="/events" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to all sessions
        </Link>
        <h1 className="text-3xl font-bold mb-2">Session Details</h1>
        <div className="bg-gray-100 p-4 rounded-lg">
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-semibold">Session ID:</span> {sessionId}
          </p>
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-semibold">Project:</span> {firstEvent.project_name}
          </p>
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-semibold">Total Events:</span> {sessionEvents.length}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Duration:</span> {new Date(firstEvent.timestamp).toLocaleString()} - {new Date(lastEvent.timestamp).toLocaleString()}
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mb-4">Events Timeline</h2>
      <div className="space-y-4">
        {sessionEvents.map((event, index) => (
          <div key={event.uuid} className="relative">
            {index > 0 && (
              <div className="absolute left-6 top-0 -mt-4 w-0.5 h-4 bg-gray-300"></div>
            )}
            <div className="flex items-start space-x-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${
                event.event_type === 'user' ? 'bg-blue-500' : 
                event.event_type === 'assistant' ? 'bg-green-500' : 
                'bg-gray-500'
              }`}>
                {event.event_type === 'user' ? 'U' : 
                 event.event_type === 'assistant' ? 'A' : 
                 'S'}
              </div>
              <div className="flex-1 border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="mb-2 text-sm text-gray-600">
                  <span className="font-semibold">{event.event_type}</span> • {new Date(event.timestamp).toLocaleTimeString()}
                  {event.is_sidechain && <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Sidechain</span>}
                </div>
                <pre className="text-sm overflow-x-auto">
                  {JSON.stringify(event, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}