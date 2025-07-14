import { Link, useLoaderData } from "react-router"
import { getDatabase } from "../db/database"
import { events } from "../db/schema"
import { desc } from "drizzle-orm"

export async function loader() {
  const db = getDatabase()
  
  const recentEvents = db
    .select()
    .from(events)
    .orderBy(desc(events.timestamp))
    .limit(500)
    .all()
  
  // Group events by session
  const eventsBySession = recentEvents.reduce((acc, event) => {
    if (!acc[event.session_id]) {
      acc[event.session_id] = []
    }
    acc[event.session_id].push(event)
    return acc
  }, {} as Record<string, typeof recentEvents>)
  
  return { eventsBySession }
}

export default function Events() {
  const { eventsBySession } = useLoaderData<typeof loader>()
  const sessions = Object.entries(eventsBySession)
    .sort((a, b) => {
      // Sort by most recent event in each session
      const aLatest = a[1][0].timestamp
      const bLatest = b[1][0].timestamp
      return bLatest.localeCompare(aLatest)
    })

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Claude Code Events</h1>
      <p className="text-gray-600 mb-8">Recent sessions</p>
      
      {sessions.length === 0 ? (
        <p className="text-gray-500">No events found</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map(([sessionId, sessionEvents]) => {
            const firstEvent = sessionEvents[0]
            const lastEvent = sessionEvents[sessionEvents.length - 1]
            const duration = new Date(lastEvent.timestamp).getTime() - new Date(firstEvent.timestamp).getTime()
            const durationMinutes = Math.round(duration / 1000 / 60)
            
            // Count event types
            const eventCounts = sessionEvents.reduce((acc, event) => {
              acc[event.event_type] = (acc[event.event_type] || 0) + 1
              return acc
            }, {} as Record<string, number>)
            
            return (
              <Link
                key={sessionId}
                to={`/events/${sessionId}`}
                className="block border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow hover:border-blue-300"
              >
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">
                    {firstEvent.project_name}
                  </h2>
                  <p className="text-xs text-gray-500 font-mono">
                    {sessionId}
                  </p>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <span className="font-semibold">{sessionEvents.length}</span> event{sessionEvents.length !== 1 ? 's' : ''}
                  </p>
                  <p>
                    <span className="font-semibold">{durationMinutes}</span> minute{durationMinutes !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs">
                    {new Date(firstEvent.timestamp).toLocaleString()}
                  </p>
                </div>
                
                <div className="mt-4 flex flex-wrap gap-2">
                  {Object.entries(eventCounts).map(([type, count]) => (
                    <span
                      key={type}
                      className={`px-2 py-1 text-xs rounded ${
                        type === 'user' ? 'bg-blue-100 text-blue-800' :
                        type === 'assistant' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {type}: {count}
                    </span>
                  ))}
                </div>
                
                <div className="mt-4 text-blue-600 text-sm font-medium">
                  View Events →
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}