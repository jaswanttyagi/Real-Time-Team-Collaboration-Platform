import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import { authenticate } from '../../middleware/auth.middleware.js'
import { authorize } from '../../middleware/role.middleware.js'
import { validate } from '../../middleware/validate.middleware.js'
import {
    assignProjectSchema,
    createProjectSchema,
    createTaskSchema,
    listProjectsQuerySchema,
    projectIdParamsSchema,
    projectTaskParamsSchema,
    updateProjectStatusSchema,
    updateProjectSchema,
} from './projects.schemas.js'
import {
    assignProjectToDeveloper, createProject, createTaskForProject,
    deleteCompletedProject,
    getProjectById,
    listProjects,
    updateProject,
    updateProjectStatus,
} from './projects.service.js'

export const projectsRouter = Router()

projectsRouter.use(authenticate)

projectsRouter.get('/', authorize('ADMIN', 'PM', 'DEVELOPER'),
    validate({ query: listProjectsQuerySchema }),
    asyncHandler(async (req, res) => {
        const data = await listProjects(req.user!, req.query)
        res.json({
            success: true,
            data
        })
    })
)

// Route to create a new project, accessible by admin and pm only

projectsRouter.post('/', authorize('ADMIN', 'PM'),
    validate({ body: createProjectSchema }),
    asyncHandler(async (req, res) => {
        const project = await createProject(req.user!, req.body)
        res.status(201).json({
            success: true,
            data: {
                project,
            }
        })
    })
)

// fetch projects on this route

projectsRouter.get('/:id', authorize('ADMIN', 'PM', 'DEVELOPER'),
    validate({ params: projectIdParamsSchema }),
    asyncHandler(async (req, res) => {
        const project = await getProjectById( req.params.id as string,req.user!)
        res.json({
            success: true,
            data: {
                project,
            }
        })
    })
)

projectsRouter.patch('/:id/assign', authorize('PM'),
    validate({ params: projectIdParamsSchema, body: assignProjectSchema }),
    asyncHandler(async (req, res) => {
        const project = await assignProjectToDeveloper(req.params.id as string,
            req.user!,
            req.body.developerId)
        res.json({
            success: true,
            data: {
                project,
            }
        })
    })
)

// patch route to update project status, accessible by admin, pm and assigned developer

projectsRouter.patch('/:id/status', authorize('ADMIN', 'PM', 'DEVELOPER'),
    validate({ params: projectIdParamsSchema, body: updateProjectStatusSchema }),
    asyncHandler(async (req, res) => {
        const project = await updateProjectStatus(req.params.id as string,
            req.user!,
            req.body.status)
        res.json({
            success: true,
            data: {
                project,
            }
        })
    })
)

// Additional routes for updating project details, creating tasks, and deleting completed projects can be added similarly

projectsRouter.patch('/:id', authorize('ADMIN', 'PM'),
    validate({ params: projectIdParamsSchema, body: updateProjectSchema }),
    asyncHandler(async (req, res) => {
        const project = await updateProject(req.params.id as string, req.user!, req.body)
        res.json({
            success: true,
            data: {
                project,
            }
        })
    })
)

// Only admin can delete completed projects
projectsRouter.delete('/:id', authorize('ADMIN'),
    validate({ params: projectIdParamsSchema }),
    asyncHandler(async (req, res) => {
        const result = await deleteCompletedProject(req.params.id as string, req.user!)
        res.json({
            success: true,
            data: result,
        })
    }),
)

projectsRouter.post('/:projectId/tasks', 
    authorize('ADMIN', 'PM'),
    validate({ params: projectTaskParamsSchema, body: createTaskSchema }),
    asyncHandler(async (req, res) => {
        const task = await createTaskForProject(req.params.projectId as string, req.user!, req.body)
        res.status(201).json({
            success: true,
            data: {
                task,
            }
        })
    })
)