export const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'

export async function api(path, opts={}){
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'content-type':'application/json', ...(opts.headers||{}) },
    ...opts,
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}
