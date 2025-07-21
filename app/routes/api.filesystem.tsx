import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

interface LoaderArgs {
  request: Request
}

export async function loader({ request }: LoaderArgs) {
  const url = new URL(request.url)
  const action = url.searchParams.get('action')
  const pathParam = url.searchParams.get('path')

  if (!action) {
    return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  switch (action) {
    case 'validate': {
      if (pathParam === null) {
        return Response.json({ error: 'Path parameter is required' }, { status: 400 })
      }

      const resolvedPath = path.resolve(pathParam || process.cwd())
      const normalizedPath = path.normalize(resolvedPath)

      try {
        // Use realpath to get the actual case of the directory on disk
        // This handles case-insensitive filesystems properly
        const realPath = await fs.realpath(normalizedPath)
        return Response.json({ valid: true, resolvedPath: realPath })
      } catch {
        return Response.json({ valid: false, resolvedPath: normalizedPath })
      }
    }

    case 'expand': {
      if (!pathParam) {
        return Response.json({ expandedPath: process.cwd() })
      }

      let expandedPath: string

      if (pathParam.startsWith('~')) {
        const homedir = os.homedir()
        const relativePath = pathParam.slice(2) // Remove ~/ or just ~
        expandedPath = path.resolve(homedir, relativePath)
      } else if (path.isAbsolute(pathParam)) {
        expandedPath = path.resolve(pathParam)
      } else {
        expandedPath = path.resolve(process.cwd(), pathParam)
      }

      const normalizedPath = path.normalize(expandedPath)
      return Response.json({ expandedPath: normalizedPath })
    }

    case 'current': {
      return Response.json({ currentDirectory: process.cwd() })
    }

    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 })
  }
}