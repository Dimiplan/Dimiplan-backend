import { getUser } from '@/models/userModel'
import express from 'express'

const router = express.Router()

router.get('/whoami', async (req, res) => {
  //@ts-ignore
  const uid = req.session?.passport?.user.id
  if (!uid)
    res.status(401).json({ message: 'Not authenticated' })
  const user = await getUser(uid)
  if (user)
    res.json(user)
  else
    res.status(404).json({ message: 'User not found' })
})

export default router