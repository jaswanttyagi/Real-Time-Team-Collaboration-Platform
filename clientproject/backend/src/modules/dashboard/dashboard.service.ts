import { Role, TaskStatus } from '@prisma/client'
import { prisma } from '../../prisma/client.js'
import { listActivities } from '../activities/activities.service.js'
import { listTasks } from '../tasks/tasks.service.js'
import { getOnlineUsersCount } from '../../socket/presence.js'

export const getAdminDashboard = async()=>{
    const [totalProjects, overdueCount, statusGroups, recentActivity] = await Promise.all([prisma.project.count(),
        prisma.task.count({
            where: {
                isOverdue: true,
                    status:{
                        not: TaskStatus.DONE,
                    },
                },
        }),
        prisma.task.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    }),
    listActivities({ id: 'admin', role: Role.ADMIN }, { page: 1, limit: 10 }),
    ])

    const tasksByStatus = {
        TO_DO: 0,
        IN_PROGRESS: 0,
        IN_REVIEW: 0,
        DONE: 0,
    }

    for(const group of statusGroups){
        tasksByStatus[group.status] = group._count.status
    }
    return{
        totalProjects,
        tasksByStatus,
        overdueCount,
        recentActivity: recentActivity.items,
        onlineUsers: getOnlineUsersCount(),
    }
}


// PM DASHBOARD

export const getPmDashboard = async(user : {id:string; role: Role})=>{
    const startOfWeek = new Date()
    startOfWeek.setHours(0,0,0,0)
        const endofWeek = new Date(startOfWeek)
        endofWeek.setDate(endofWeek.getDate() + 7)

       const [projectCount, tasksByPriority, dueThisWeek, recentActivity] = await Promise.all([
        prisma.project.count({
            where: { 
                createdById: user.id,
            },
        }),
        prisma.task.groupBy({
            by: ['priority'],
            where: { 
                project: {
                   createdById: user.id,
                },
            },
            _count: {
                priority: true,
            },
        }),
        prisma.task.findMany({
            where: {
                project: {
                    createdById: user.id,
                },  
                dueDate: {
                    gte: startOfWeek,
                    lte: endofWeek,
                },
                status:{
                    not: TaskStatus.DONE,
                }
            },
            orderBy:{
                dueDate: 'asc',
            },
                take: 10,
                include: {
                    project:{
                        select:{
                            id: true,
                            name:true,
                        },
                    },
                    assignedDeveloper:{
                        select:{
                            id: true,
                            name: true,
                        },
                    }
                },
        }),
        listActivities({ id: user.id, role: Role.PM }, { page: 1, limit: 10 }),
    ])
    return {
        projectSummary:{
            totalProjects: projectCount,
        },
        tasksByPriority,
    upcomingDueDates: dueThisWeek,
    recentActivity: recentActivity.items,
    }
}

// Developer Dashboard
export const getDeveloperDashboard = async(user : {id:string; role: Role})=>{
    const [assignedTasks, unreadCount, recentActivity] = await Promise.all([
        listTasks({ id: user.id, role: Role.DEVELOPER }, { page: 1, limit: 20 }),
        prisma.notification.count({
            where: {
               recipientUserId: user.id,
        isRead: false,
            },
        }),
        listActivities({ id: user.id, role: Role.DEVELOPER }, { page: 1, limit: 10 }),
    ])
    return {
        assignedTasks: assignedTasks.items,
        unreadCount,
        recentActivity: recentActivity.items,
    }
}