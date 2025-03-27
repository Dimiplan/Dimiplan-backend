import { getUser, isRegistered, updateUser, User } from '@/models/userModel'
import express from 'express'

const router = express.Router()

router.post('/updateme', async (req, res) => {
  //@ts-ignore
  const uid = req.session?.passport?.user.id
  if (!uid)
    res.status(401).json({ message: 'Not authenticated' })
  else {
    // 이름: 15글자 이하
    // 학년: 1~3
    // 반: 1~6
    let isValid = true
    if (req.query.name && req.query.name.toString().length > 15)
      isValid = false
    if (req.query.grade && (isNaN(parseInt(req.query.grade.toString())) || parseInt(req.query.grade.toString()) > 3 || parseInt(req.query.grade.toString()) < 1))
      isValid = false
    if (req.query.class && (isNaN(parseInt(req.query.class.toString())) || parseInt(req.query.class.toString()) > 6 || parseInt(req.query.class.toString()) < 1))
      isValid = false
    if (!isValid)
      res.status(400).json({ message: 'Bad request' })
  else {
    const name = !req.query.name ? undefined : req.query.name.toString()
    const grade = !req.query.grade ? undefined : parseInt(req.query.grade.toString())
    const class_ = !req.query.class ? undefined : parseInt(req.query.class.toString())
    const email = !req.query.email ? undefined : req.query.email.toString()
    const profile_image = !req.query.profile_image ? undefined : req.query.profile_image.toString()
    const user: Partial<User> = {
      name: name,
      grade: grade,
      class: class_,
      email: email,
      profile_image: profile_image
    }
    console.log(user)
    if (user.name === undefined && user.grade === undefined && user.class === undefined && user.email === undefined && user.profile_image === undefined)
      res.status(400).json({ message: 'Bad request' })
    else {
      await updateUser(uid, user)
      res.status(200).json({ message: 'Updated' })
      }
  }
  }
})
router.get('/registered', async (req, res) => {
  //@ts-ignore
  const uid = req.session?.passport?.user.id
  if (!uid)
    res.status(401).json({ message: 'Not authenticated' })
  else
    res.status(200).json({ registered: await isRegistered(uid) })
})

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

router.get('/whoami', async (req, res) => {
  //@ts-ignore
  const uid = req.session?.passport?.user.id
  const user = await getUser(uid)
  if (user)
    res.status(200).json(user)
  else
    res.status(404).json({ message: 'User not found' })
})

export default router