// Playwright resolves a leading slash from the origin, so include the app prefix.
export const appPath = (path: string) => (process.env.APP_BASE_PATH ?? '/').replace(/\/$/, '') + path;
