const onlineUsers = new Map<string, { scopeAdminId: string; socketIds: Set<string> }>()

export const addPresence = (userId: string, scopeAdminId: string, socketId: string) => {
  const entry = onlineUsers.get(userId) ?? {
    scopeAdminId,
    socketIds: new Set<string>(),
  }

  entry.scopeAdminId = scopeAdminId
  entry.socketIds.add(socketId)
  onlineUsers.set(userId, entry)
  return getOnlineUsersCount(scopeAdminId)
}

export const removePresence = (userId: string, socketId: string) => {
  const entry = onlineUsers.get(userId)
  if (!entry) {
    return 0
  }

  entry.socketIds.delete(socketId)
  if (entry.socketIds.size === 0) {
    onlineUsers.delete(userId)
  } else {
    onlineUsers.set(userId, entry)
  }

  return getOnlineUsersCount(entry.scopeAdminId)
}

export const getOnlineUsersCount = (scopeAdminId?: string) => {
  if (!scopeAdminId) {
    return onlineUsers.size
  }

  let count = 0
  for (const entry of onlineUsers.values()) {
    if (entry.scopeAdminId === scopeAdminId) {
      count += 1
    }
  }

  return count
}
