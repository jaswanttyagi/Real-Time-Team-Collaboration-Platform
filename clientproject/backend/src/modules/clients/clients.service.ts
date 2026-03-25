import {prisma} from '../../prisma/client.js'
import {badRequest , notFound} from '../../lib/errors.js'
import {getLimit , getPage} from '../../lib/pagination.js'
import type { WorkspaceUser } from '../../lib/workspace.js'

const selectClientFields = {
    id : true,
    name : true,
    contactName : true,
    contactEmail : true,
    createdAt : true,
    updatedAt : true,
} as const

// list of client with pagination and search
export const listClients = async(
    user: WorkspaceUser,
    query : {search? : string ; page? : number; limit? : number},
) => {
    const page = getPage(query.page?.toString())
    const limit = getLimit(query.limit?.toString())
    const where = {
        createdById: user.scopeAdminId,
        ...(query.search
            ? {
                name : {
                    contains : query.search,
                    mode : 'insensitive' as const,
                },
            }
            : {}),
    }

    const [items , total] = await prisma.$transaction([
            prisma.client.findMany({
            where,
            orderBy: { name: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
            select: selectClientFields,
    }),
    prisma.client.count({ where }),
    ])

    return {
        items ,
        meta:{
            page,
            limit,
            total,
            totalPages : Math.ceil(total / limit) || 1,
        },
    }
}

// this controller is used to create a new client and only used by admin 
export const createClient = async(user: WorkspaceUser,
    input:{
        name: string;
        contactName?: string;
        contactEmail?: string;
    }
)=>{
    const client = await prisma.client.create({
        data : {
            ...input,
            createdById:user.scopeAdminId,
        },
        select: selectClientFields
    })
    return client
}


// update client details and only used by admin
export const updateClient = async(
    user: WorkspaceUser,
    clientId : string,
    input:{
        name ?: string;
        contactName ?: string|null;
        contactEmail ?: string|null;
    },
)=>{
    const client = await prisma.client.findFirst({
        where : {
            id : clientId,
            createdById: user.scopeAdminId,
        },
    })
    if(!client){
        throw notFound('Client not found')
    }
    return prisma.client.update({
        where : {id : clientId},
        data : input,
        select: selectClientFields,
    })
}

// if the admin want then it can delete the client

export const deleteClient = async(user: WorkspaceUser, clientId : string)=>{
    const client = await prisma.client.findFirst({
        where : {
            id : clientId,
            createdById: user.scopeAdminId,
        },
    })
    if(!client){
        throw notFound('Client not found')
    }
    const linkedProjects = await prisma.project.count({
        where:{clientId},
    })
    if(linkedProjects > 0){
        throw badRequest('Cannot delete client with linked projects')
    }
    await prisma.client.delete({
        where : {id : clientId},
    })

    return {message : 'Client deleted successfully',
    }
}
