import { CookieOptions, Request, Response } from 'express'
import {Role} from '@prisma/client'
import {prisma} from '../../prisma/client.js'
import {comparePassword} from '../../lib/password.js'
import {badRequest, conflict, unauthorized} from '../../lib/errors.js'
import {env, isProduction} from '../../config/env.js'
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../lib/jwt.js'
import { hashPassword } from '../../lib/password.js'


const refreshCookieOptions : CookieOptions={
    httpOnly: true,
    sameSite:'lax',
    secure: isProduction,
    path:'/', 
}

const sanitizeUser = (user :{
    id:string,
    name:string,
    email:string,
    role:'ADMIN'|'PM'|'DEVELOPER',
    isActive:boolean
}) =>({
    id:user.id,
    name:user.name,
    email:user.email,
    role:user.role,
    isActive: user.isActive,
})

const issueSessionTokens = async(
    user:{
      id: string
    name: string
    email: string
    role: 'ADMIN' | 'PM' | 'DEVELOPER'
    isActive: boolean  
    },
    request:Request,
)=>{
    const session = await prisma.session.create({
        data:{
            userId:user.id,
            refreshTokenHash: '',
            userAgent: request.get('user-agent') ?? null,
            ipAddress: request.ip ?? null,
            expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
    })

    const refreshToken = signRefreshToken({
        sub:user.id,
        sessionId:session.id,
    })
    await prisma.session.update({
        where:{id:session.id},
        data:{
            refreshTokenHash: hashToken(refreshToken),
        },
    })
    const accessToken = signAccessToken({
        sub:user.id,
        role:user.role,
        email:user.email,
        name:user.name,
    })
    return {accessToken, refreshToken}
}

// login controller

export const login = async(
    request : Request,
    response : Response,
    email: string,
    password: string,
    selectedRole: Role,
)=>{
    const user = await prisma.user.findUnique({
        where:{email : email.toLowerCase()},
    })
    
    if(!user || !user.isActive){
        throw unauthorized('Invalid email or password')
    }

    const passwordMatches = await comparePassword(password , user.passwordHash)
    if(!passwordMatches){
        throw unauthorized('Invalid email or password')
    }
    assertSelectedRole(selectedRole, user.role)

    const {accessToken, refreshToken} = await issueSessionTokens(user, request)

    response.cookie(env.REFRESH_COOKIE_NAME, refreshToken, {
        ...refreshCookieOptions,
        expires: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    })
    return {
        user: sanitizeUser(user),
        accessToken,
    }
}

// new user register controller
export const register = async(
    request: Request,
    response: Response,
    input:{
    name: string,
    email: string,
    password: string,
    role: Role,
},
)=>{
    const email = input.email.toLowerCase()
    const existingUser = await prisma.user.findUnique({
        where:{email},
    })
    if(existingUser){
        throw conflict('Email is already in use')
    }

        assertPasswordStrength(input.password)
        if(input.role === 'ADMIN'){
            const adminCount = await prisma.user.count({
                where:{role:'ADMIN'},
            })

            if(adminCount > 0){
                throw badRequest('Admin role is already assigned to another user')
            }
        }
        const user = await prisma.user.create({
            data:{
                name: input.name.trim(),
                email,
                passwordHash: await hashPassword(input.password),
                role: input.role,
            },
        })

        const{accessToken, refreshToken} = await issueSessionTokens(user, request)

        response.cookie(env.REFRESH_COOKIE_NAME, refreshToken, {
            ...refreshCookieOptions,
            expires: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
        })
        return {
            user: sanitizeUser(user),
            accessToken,
        }
    }

    export const refreshAccessToken = async(
        request: Request, response: Response,
    )=>{
        const refreshToken = request.cookies[env.REFRESH_COOKIE_NAME]
        if(typeof refreshToken !== 'string' || refreshToken.length === 0){
            throw unauthorized('Refresh token is missing')
        }
       let payload: ReturnType<typeof verifyRefreshToken>
    try {
    payload = verifyRefreshToken(refreshToken)
    } catch {
    throw unauthorized('Invalid refresh token')
  }
  
  const session = await prisma.session.findFirst({
    where: {
      id: payload.sessionId,
      userId: payload.sub,
      refreshTokenHash: hashToken(refreshToken),
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
    },
},
    include: { user: true },
  })
    if (!session || !session.user.isActive) {
        throw unauthorized('Invalid refresh token')
    }
    const nextRefreshToken = signRefreshToken({
        sub: session.userId,
        sessionId: session.id,
    })
    await prisma.session.update({
        where: { id: session.id },
        data: {
            refreshTokenHash: hashToken(nextRefreshToken),
            expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
    })

    const accessToken = signAccessToken({
        sub: session.userId,
        role: session.user.role,
        name: session.user.name,
        email: session.user.email,
    })
    response.cookie(env.REFRESH_COOKIE_NAME, nextRefreshToken, {
        ...refreshCookieOptions,
        expires: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    })
    return {
        accessToken,
    }
}


// logout controller
export const logout = async(
    request: Request,
    response: Response,)=>{
    const refreshToken = request.cookies[env.REFRESH_COOKIE_NAME]
    if(typeof refreshToken === 'string' && refreshToken.length > 0){
       await prisma.session.updateMany({
        where:{
            refreshTokenHash: hashToken(refreshToken),
            revokedAt: null,
        },
        data:{
            revokedAt: new Date(),
        },
    })
}
response.clearCookie(env.REFRESH_COOKIE_NAME, refreshCookieOptions)
return {
    message: 'Logged out successfully',
}
}

// get current user controller
export const getCurrentUser = async(
    userId: string,
)=>{
    const user = await prisma.user.findUnique({
        where:{id: userId},
    })
    if(!user || !user.isActive){
        throw unauthorized('User not found')
    }
    return sanitizeUser(user)
}

export const assertPasswordStrength = (password: string) => {
  if (password.length < 8) {
    throw badRequest('Password must be at least 8 characters long')
  }
}
// selected role assertion
export const assertSelectedRole = (selectedRole: Role, actualRole: Role) => {
  if (selectedRole !== actualRole) {
    throw unauthorized(`This account belongs to the ${actualRole} login flow`)
  }
}
