import { getUser, isRegistered, updateUser, User } from '@/models/userModel'
import express from 'express'

const router = express.Router()

// router.get('/register', async (req, res) => {
//   //@ts-ignore
//   const uid = req.session?.passport?.user.id
//   if (!uid)
//     res.status(401).json({ message: 'Not authenticated' })
//   const name = !req.query.name ? null : req.query.name.toString()
//   const grade = !req.query.grade ? null : parseInt(req.query.grade.toString())
//   const class_ = !req.query.class ? null : parseInt(req.query.class.toString())
//   if (!name || !grade || !class_)
//     res.status(400).json({ message: 'Bad request' })
//   else {
//     await registerUser(uid, name, grade, class_)
//     res.status(200).json({ message: 'Registered' })
//   }
// })
router.get('/updateme', async (req, res) => {
  //@ts-ignore
  const uid = req.session?.passport?.user.id
  if (!uid)
    res.status(401).json({ message: 'Not authenticated' })
  else {
    const name = !req.query.name ? undefined : req.query.name.toString()
    const grade = !req.query.grade || isNaN(parseInt(req.query.grade.toString())) ? undefined : parseInt(req.query.grade.toString())
    const class_ = !req.query.class || isNaN(parseInt(req.query.class.toString())) ? undefined : parseInt(req.query.class.toString())
    const email = !req.query.email ? undefined : req.query.email.toString()
    const profile_image = !req.query.profile_image ? undefined : req.query.profile_image.toString()
    const user: Partial<User> = {
      name: name,
      grade: grade && grade <= 3 && grade >= 1 ? grade : undefined,
      class: class_ && class_ <= 6 && class_ >= 1 ? class_ : undefined,
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
})
router.get('/registered', async (req, res) => {
  //@ts-ignore
  const uid = req.session?.passport?.user.id
  if (!uid)
    res.status(401).json({ message: 'Not authenticated' })
  else
    res.json({ registered: await isRegistered(uid) })
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
    res.json(user)
  else
    res.status(404).json({ message: 'User not found' })
})

export default router