const { getUser, isRegistered, updateUser } = require('../../models/userModel');
const express = require('express');

const router = express.Router();

router.post('/updateme', async (req, res, next) => {
    // 세션 정보에서 사용자 id 추출
    const { name: nameInput, grade: gradeInput, class: classInput, email: emailInput, profile_image: profile_imageInput } = req.body;
    const uid =
        req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id;
    if (!uid) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    } else {
        // 이름: 15글자 이하, 학년: 1~3, 반: 1~6
        let isValid = true;
        if (nameInput && nameInput.toString().length > 15) isValid = false;
        if (gradeInput &&
        (isNaN(parseInt(gradeInput.toString())) ||
            parseInt(gradeInput.toString()) > 3 ||
            parseInt(gradeInput.toString()) < 1)
        ) isValid = false;


        if (classInput &&
        (isNaN(parseInt(classInput.toString())) ||
            parseInt(classInput.toString()) > 6 ||
            parseInt(classInput.toString()) < 1)
        ) isValid = false;
        if (!isValid) {
            res.status(400).json({ message: 'Bad request' });
            return;
        } else {
            const name = !nameInput ? undefined : nameInput.toString();
            const grade =
                !gradeInput ? undefined : parseInt(gradeInput.toString());
            const class_ =
                !classInput ? undefined : parseInt(classInput.toString());
            const email = !emailInput ? undefined : emailInput.toString();
            const profile_image =
                !profile_imageInput ? undefined : profile_imageInput.toString();

            const userData = {
                name: name && name.trim() !== '' ? name : undefined,
                grade:
                grade !== undefined && !isNaN(grade) ? grade : undefined,
                class:
                class_ !== undefined && !isNaN(class_) ? class_ : undefined,
                email: email !== undefined ? email : undefined,
                profile_image: profile_image !== undefined ? profile_image : undefined,
            };

            // 모든 업데이트 필드가 undefined 인 경우
            if (
                userData.name === undefined &&
                userData.grade === undefined &&
                userData.class === undefined &&
                userData.email === undefined &&
                userData.profile_image === undefined
            ) {
                res.status(400).json({ message: 'Bad request' });
                return;
            }

            console.log(userData);
            try {
                await updateUser(uid, userData);
                res.status(200).json({ message: 'Updated' });
                return;
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Internal server error' });
                next(error);
            }
        }
    }
});

router.get('/registered', async (req, res) => {
    const uid =
        req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id;
    if (!uid)
        res.status(401).json({ message: 'Not authenticated' });
    else {
        const registered = await isRegistered(uid);
        res.status(200).json({ registered: registered });
    }
});

// 미들웨어: 인증 및 등록 여부 검사
// router.use(async (req, res, next) => {
//     const uid =
//         req.session &&
//         req.session.passport &&
//         req.session.passport.user &&
//         req.session.passport.user.id;
//     if (!uid)
//         res.status(401).json({ message: 'Not authenticated' });
//     else {
//         if (await isRegistered(uid))
//         next();
//         else
//         res.status(403).json({ message: 'Not registered' });
//     }
// });

router.get('/whoami', async (req, res) => {
    const uid =
        req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id;
    if (!uid) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }
    const user = await getUser(uid);
    if (user) {
        console.log(user);
        res.status(200).json(user);
    } else {
        res.status(404).json({ message: 'User not found' });
        
    }
});

module.exports = router;