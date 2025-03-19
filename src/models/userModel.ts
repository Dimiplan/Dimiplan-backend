import db from '@/config/db'

export interface User {
  id: string
  name: string | null
  grade: number | null
  class: number | null
  email: string
  profile_image: string
}

export const isUserExists = async (uid: string): Promise<boolean> => {
  const count = await db('users')
    .where('id', uid)
    .count<{ count: string }[]>('* as count')
  return parseInt(count[0].count) > 0
}

export const createUser = async (user: User): Promise<void> => {
  if (!(await isUserExists(user.id))) {
    return await db('users')
      .insert(user)
  }
}

export const getUser = async (uid: string): Promise<User | null> => {
  const user = await db('users')
    .where('id', uid)
    .select<User[]>('*')
  return user[0] || null
}

export const isRegistered = async (uid: string): Promise<boolean> => {
  const user = await getUser(uid)
  return user !== null && user.name !== null && user.grade !== null && user.class !== null
}