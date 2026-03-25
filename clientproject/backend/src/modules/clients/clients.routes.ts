import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import { authenticate } from '../../middleware/auth.middleware.js'
import { authorize } from '../../middleware/role.middleware.js'
import { validate } from '../../middleware/validate.middleware.js'
import {
  clientIdParamsSchema,
  createClientSchema,
  listClientsQuerySchema,
  updateClientSchema,
} from './clients.schemas.js'
import { createClient, deleteClient, listClients, updateClient } from './clients.service.js'

export const clientsRouter = Router()

clientsRouter.use(authenticate)

clientsRouter.get(
  '/',
  authorize('ADMIN', 'PM'),
  validate({ query: listClientsQuerySchema }),
  asyncHandler(async (req, res) => {
    const data = await listClients(req.query)
    res.json({
      success: true,
      data,
    })
  }),
)

clientsRouter.post(
  '/',
  authorize('ADMIN'),
  validate({ body: createClientSchema }),
  asyncHandler(async (req, res) => {
    const client = await createClient(req.user!.id, req.body)
    res.status(201).json({
      success: true,
      data: {
        client,
      },
    })
  }),
)

clientsRouter.patch(
  '/:id',
  authorize('ADMIN'),
  validate({ params: clientIdParamsSchema, body: updateClientSchema }),
  asyncHandler(async (req, res) => {
    const client = await updateClient(req.params.id as string, req.body)
    res.json({
      success: true,
      data: {
        client,
      },
    })
  }),
)

clientsRouter.delete(
  '/:id',
  authorize('ADMIN'),
  validate({ params: clientIdParamsSchema }),
  asyncHandler(async (req, res) => {
    const data = await deleteClient(req.params.id as string)
    res.json({
      success: true,
      data,
    })
  }),
)
