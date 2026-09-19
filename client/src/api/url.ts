// Assets, client routes, and API requests share the public deployment prefix.
export const apiUrl = (path: string) => import.meta.env.BASE_URL + 'api' + path;
