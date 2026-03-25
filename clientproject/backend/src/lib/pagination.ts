export const getPage = (value?: string) => {
  const page = Number.parseInt(value ?? '1', 10)
  return Number.isNaN(page) || page < 1 ? 1 : page
}

export const getLimit = (value?: string, defaultLimit = 20, maxLimit = 50) => {
  const limit = Number.parseInt(value ?? `${defaultLimit}`, 10)
  if (Number.isNaN(limit) || limit < 1) {
    return defaultLimit
  }

  return Math.min(limit, maxLimit)
}
