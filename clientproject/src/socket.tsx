import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import { useAuth } from './auth'
import { ensureSocketUrl } from './network'
import type { Activity } from './types'

type SocketContextValue = {
  unreadCount: number
  onlineUsers: number | null
  liveActivities: Activity[]
  joinProject: (projectId: string) => void
  joinTask: (taskId: string) => void
}

const SocketContext = createContext<SocketContextValue | null>(null)

const mergeActivities = (current: Activity[], nextBatch: Activity[]) => {
  const map = new Map<string, Activity>()

  for (const item of [...nextBatch, ...current]) {
    map.set(item.id, item)
  }

  return Array.from(map.values())
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 20)
}

export const SocketProvider = ({ children }: PropsWithChildren) => {
  const { user, accessToken, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const socketRef = useRef<Socket | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [onlineUsers, setOnlineUsers] = useState<number | null>(null)
  const [liveActivities, setLiveActivities] = useState<Activity[]>([])

  const ingestActivities = useCallback((batch: Activity[]) => {
    setLiveActivities((current) => mergeActivities(current, batch))

    const newest = batch[0]
    if (newest) {
      localStorage.setItem('clientproject:last-activity-at', newest.createdAt)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !user || !accessToken) {
      socketRef.current?.disconnect()
      socketRef.current = null
      setUnreadCount(0)
      setOnlineUsers(null)
      setLiveActivities([])
      return
    }

    let isCancelled = false
    let socket: Socket | null = null

    const connectSocket = async () => {
      const socketUrl = await ensureSocketUrl()
      if (isCancelled) {
        return
      }

      socket = io(socketUrl, {
        auth: {
          token: accessToken,
        },
        path: '/socket.io',
      })

      socketRef.current = socket

      socket.on('connect', () => {
        const since = localStorage.getItem('clientproject:last-activity-at') ?? undefined
        socket?.emit('activity:sync', { since })
      })

      socket.on('activity:new', (activity: Activity) => {
        ingestActivities([activity])
        void queryClient.invalidateQueries({ queryKey: ['activities'] })
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        void queryClient.invalidateQueries({ queryKey: ['tasks'] })
        void queryClient.invalidateQueries({ queryKey: ['projects'] })
      })

      socket.on('activity:missed', (activities: Activity[]) => {
        ingestActivities(activities)
        void queryClient.invalidateQueries({ queryKey: ['activities'] })
      })

      socket.on('notification:new', () => {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      })

      socket.on('notification:unread_count', (payload: { unreadCount: number }) => {
        setUnreadCount(payload.unreadCount)
      })

      socket.on('project:updated', () => {
        void queryClient.invalidateQueries({ queryKey: ['projects'] })
        void queryClient.invalidateQueries({ queryKey: ['project'] })
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      })

      socket.on('project:deleted', () => {
        void queryClient.invalidateQueries({ queryKey: ['projects'] })
        void queryClient.invalidateQueries({ queryKey: ['project'] })
        void queryClient.invalidateQueries({ queryKey: ['tasks'] })
        void queryClient.invalidateQueries({ queryKey: ['activities'] })
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      })

      socket.on('presence:update', (payload: { onlineUsers: number }) => {
        setOnlineUsers(payload.onlineUsers)
      })
    }

    void connectSocket()

    return () => {
      isCancelled = true
      socket?.disconnect()

      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }
  }, [accessToken, ingestActivities, isAuthenticated, queryClient, user])

  const joinProject = useCallback((projectId: string) => {
    socketRef.current?.emit('project:join', projectId)
  }, [])

  const joinTask = useCallback((taskId: string) => {
    socketRef.current?.emit('task:join', taskId)
  }, [])

  const value = useMemo<SocketContextValue>(
    () => ({
      unreadCount,
      onlineUsers,
      liveActivities,
      joinProject,
      joinTask,
    }),
    [joinProject, joinTask, liveActivities, onlineUsers, unreadCount],
  )

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export const useRealtime = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useRealtime must be used inside SocketProvider')
  }

  return context
}
