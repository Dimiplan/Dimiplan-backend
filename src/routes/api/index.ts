import { getUser, isRegistered, updateUser, User } from '@/models/userModel'
import express from 'express'
import user from './user'

const router = express.Router()

router.use('/user', user)

router.use(async (req, res, next) => {
  //@ts-ignore
  const uid = req.session?.passport?.user.id
  if (!uid)
    res.status(401).json({ message: 'Not authenticated' })
  else {
    if (await isRegistered(uid))
      next()
    else
      res.status(403).json({ message: 'Not registered' })
  }
})

export default router