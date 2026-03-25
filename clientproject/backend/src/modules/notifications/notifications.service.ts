import { EntityType, NotificationType, type Prisma } from '@prisma/client'
import { prisma } from '../../prisma/client.js'
import { notFound } from '../../lib/errors.js'
import { getLimit, getPage } from '../../lib/pagination.js'
import { emitNotification } from '../../socket/index.js'

const notificationSelect = {
  id: true,
  recipientUserId: true,
  type: true,
  title: true,
  message: true,
  entityType: true,
  entityId: true,
  isRead: true,
  readAt: true,
  createdAt: true,
} as const

const countUnreadNotifications = (userId: string) => 
   prisma.notification.count({
    where: {
      recipientUserId: userId,
      isRead: false,
    },
  })
  type InAppNotificationInput = {
    recipientUserId: string
    type: NotificationType
    title: string
    message: string
    entityType: EntityType
    entityId: string
  }

// notifiaction creation when the user receives a new message
export const createInAppNotification = async (input:InAppNotificationInput, 
    tx?: Prisma.TransactionClient
) => {
    const db = tx ?? prisma
    const notification = await db.notification.create({
            data:input,
            select: notificationSelect,
    })
    if(!tx){
        const unreadCount = await countUnreadNotifications(input.recipientUserId)
        emitNotification(input.recipientUserId, notification, unreadCount)
    }
    return notification
    }

    export const createInAppNotificationOnce = async (input: InAppNotificationInput, tx?: Prisma.TransactionClient) => {
      // use passed transaction if available (to keep perform operations) otherwise back to prisma client

        const db = tx ?? prisma
        const existingNotification = await db.notification.findFirst({
            where: {
                recipientUserId: input.recipientUserId,
                type: input.type,
                entityType: input.entityType,
                entityId: input.entityId,
                message:input.message
            },
            select: notificationSelect,
        })
        if (existingNotification) {
            return existingNotification
        }
        return createInAppNotification(input, tx)
    }

    export const emitUnreadCountForUser = async (userId: string) => {
  const unreadCount = await countUnreadNotifications(userId)
  emitNotification(userId, null, unreadCount)
  return unreadCount
}


export const listNotifications = async(
    userId : string,
    query:{
        page?:number
        limit?:number
    },
)=>{
    const page = getPage(query.page?.toString())
    const limit = getLimit(query.limit?.toString() , 10 , 50)

    const[items , total , unreadCount] = await prisma.$transaction([
        prisma.notification.findMany({
            where:{
                recipientUserId : userId
            },
            orderBy:{
                createdAt:'desc'
            },
            skip:(page - 1) * limit,
            take:limit,
            select: notificationSelect,
        }),
        prisma.notification.count({
            where: {
                recipientUserId: userId
            }
        }),
        countUnreadNotifications(userId)
    ])
    return { 
        items,
        meta:{
            page ,
            limit,
            total,
            // ensure at least 1 page is returned even when there are no notifications
            totalPages: Math.ceil(total / limit) || 1,
            unreadCount,
        },
     }
}

// when notification generte it will look in number on the top of bell icon

export const getUnreadCount = async (userId: string) => ({
  unreadCount: await countUnreadNotifications(userId),
})

export const markNotificationAsRead = async(userId:string,
    notificationId:string
)=>{
    const notification = await prisma.notification.findFirst({
        where:{
            id: notificationId,
            recipientUserId: userId,
},
    })
    if(!notification){
        throw notFound('Notification not found')
    }
    const updated = await prisma.notification.update({
        where:{
            id: notificationId,
        },
        data:{
            isRead: true,
            // only set readAt if the notification was previously unread
            readAt: notification.isRead ? notification.readAt : new Date(),
        },
        select: notificationSelect,
    })
    const unreadCount = await emitUnreadCountForUser(userId)
    return { notification: updated, unreadCount }
}


export const markAllNotificationsAsRead = async (userId: string) => {
   await prisma.notification.updateMany({
    where: {
        recipientUserId: userId,
        isRead: false
    },
    data: {
        isRead: true,
        readAt: new Date()
    },
  })
  // update unread count in real-time 
  const unreadCount = await emitUnreadCountForUser(userId)
  return {unreadCount}
}
