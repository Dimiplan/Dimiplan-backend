const { getUser, isRegistered, updateUser } = require('../../models/userModel');
const express = require('express');
const db = require('../../config/db');
const router = express.Router();


router.post('/addPlan', async (req, res) => {
    const { contents, priority, from } = req.body;
    console.log(contents, priority, from);

    const uid = 
        req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id;
    if (!uid) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }

    const startDate = req.body.startDate; 
    const dueDate = req.body.dueDate; //date를 받음 (null일 수도 있음)

    let formattedStartDate = null;
    if (startDate) {
        formattedStartDate = new Date(startDate).toISOString().slice(0, 10); // "YYYY-MM-DD"
    }
    let formattedDueDate = null;
    if (dueDate) {
        formattedDueDate = new Date(dueDate).toISOString().slice(0, 10); // "YYYY-MM-DD"
    }

    const planner = await db('planner') //from 값을 받아서 그에 맞는 planner 테이블을 조회
    .where({ owner: uid, id: from })
    .select('*')
    .first();

    if (!planner) {
        res.status(404).json({ message: 'Planner not found' });
        return;
    }

    const samePlan = await db('plan')
    .where({ owner: uid, from: from, contents: contents })
    .select('*')
    .first();

    if (samePlan) {
        res.status(409).json({ message: 'Same plan already exists' });
        return;
    }

    const planId = await db('userid')
    .where({ owner: uid })
    .select('planId')
    .first()

    await db('userid')
        .where({ owner: uid })
        .update({ planId: planId + 1 })

    await db('plan').insert({ owner: uid, startDate: formattedStartDate, dueDate: formattedDueDate, 
        contents: contents, id: planId, from: planner.id, priority: priority, isCompleted: 0});
})


router.post('/addPlanner', async (req, res) => {
    const { name, isDaily, from } = req.body;
    console.log(name, isDaily, from);

    const uid = 
        req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id;
    if (!uid) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }

    const folder = await db('folders') //from 값을 받아서 그에 맞는 folder 테이블을 조회
    .where({ owner: uid, id: from })
    .select('*')
    .first();

    if (!folder) {
        res.status(404).json({ message: 'Folder not found' });
        return;
    }

    const plannerId = await db('userid')
    .where({ owner: uid })
    .select('plannerId')
    .first()

    await db('userid')
        .where({ owner: uid })
        .update({ plannerId: plannerId + 1 })

    await db('planner').insert({ owner: uid, name: name, id: plannerId, from: folder.id, isDaily: isDaily});
})


router.post('/addFolder', async (req, res) => {
    const { name, from } = req.body;
    console.log(name, from);

    const uid = 
        req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id;
    if (!uid) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }

    if (from !== -1) {
        const folder = await db('folders') //from 값을 받아서 그에 맞는 folder 테이블을 조회
        .where({ owner: uid, id: from })
        .select('*')
        .first();

        if (!folder) {
            res.status(404).json({ message: 'Folder not found' });
            return;
        }
    }

    const folderId = await db('userid')
    .where({ owner: uid })
    .select('folderId')
    .first()

    await db('userid')
        .where({ owner: uid })
        .update({ folderId: folderId + 1 })

    await db('folders').insert({ owner: uid, name: name, id: folderId, from: from });
})



router.get('/getPlanner', async (req, res) => {
    const uid = 
        req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id;
    if (!uid) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }

    const id = req.query.id;
    
    if (!id) {
        const from = req.query.from;
        const name = req.query.name;

        if (!name || !from) {
            res.status(400).json({ message: 'Id or (from + name) is required' });
            return;
        }

        const planner = await db('planner')
        .where({ owner: uid, from: from, name: name })
        .select('*')
        .first()
    }

    else {
        const planner = await db('planner')
        .where({ owner: uid, id: id })
        .select('*')
        .first()
    }

    const plans = await db('plan')
    .where({ owner: uid, from: planner.id })
    .orderByRaw('isCompleted ASC, priority ASC, id ASC')
    .select('*')

    if (plans.length === 0) {
        res.status(404).json({ message: 'Plan not found' });
    } else {
        res.status(200).json(plans);
    }
});


router.get('/getFolder', async (req, res) => {
    const uid = 
        req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id;
    if (!uid) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }

    const id = req.query.id;
    
    if (!id) {
        const from = req.query.from;
        const name = req.query.name;

        if (!name || !from) {
            res.status(400).json({ message: 'Id or (from + name) is required' });
            return;
        }

        const folder = await db('folders')
        .where({ owner: uid, from: from, name: name })
        .select('*')
        .first()
    }

    else {
        const folder = await db('folders')
        .where({ owner: uid, id: id })
        .select('*')
        .first()
    }

    const planners = await db('planner')
    .where({ owner: uid, from: folder.id })
    .orderByRaw('isDaily ASC, id ASC')
    .select('*')

    if (plans.length === 0) {
        res.status(404).json({ message: 'Planner not found' });
    } else {
        res.status(200).json(plans);
    }
});

module.exports = router;