const onlineUsers = new Map<string, Set<string>>()

export const addPresence = (userId: string, socketId: string) => {
  const sockets = onlineUsers.get(userId) ?? new Set<string>()
  sockets.add(socketId)
  onlineUsers.set(userId, sockets)
  return onlineUsers.size
}

export const removePresence = (userId: string, socketId: string) => {
  const sockets = onlineUsers.get(userId)
  if (!sockets) {
    return onlineUsers.size
  }

  sockets.delete(socketId)
  if (sockets.size === 0) {
    onlineUsers.delete(userId)
  } else {
    onlineUsers.set(userId, sockets)
  }

  return onlineUsers.size
}

export const getOnlineUsersCount = () => onlineUsers.size
