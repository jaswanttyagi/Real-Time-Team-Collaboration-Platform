export class AppError extends Error {
  statusCode: number
  code: string
  details?: unknown

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export const notFound = (message = 'Resource not found') =>
  new AppError(404, 'NOT_FOUND', message)

//  if you are not valid to access the resource then you will get this error

export const forbidden = (message = 'You do not have access to this resource') =>
  new AppError(403, 'FORBIDDEN', message)

// for the unauthorised person

export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', message)

// if server not respoonds
export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details)

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details)
