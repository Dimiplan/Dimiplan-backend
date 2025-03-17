import db from '@/config/db'

export interface User {
  id: string
  nickname: string
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