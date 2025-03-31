const { getUser, isRegistered, updateUser } = require('../../models/userModel');
const express = require('express');
const db = require('../../config/db');
const router = express.Router();


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

    const name = req.query.name;
    
    if (!name) {
        res.status(400).json({ message: 'Name is required' });
        return;
    }

    // 'folders' 테이블에서 현재 요청과 owner와 name이 같은 행을 조회
    // 'folders' 테이블에서 현재 요청과 owner와 이전에 조회한 folder_id가 같은 행을 조회
    // name 순 정렬
        const folder_id = await db('folders')
        .where({ owner: uid, name: name })
        .select('id');

    const folders = await db('folders')
        .where({ owner: uid, parent_id: folder_id })
        .orderByRaw('name ASC')
        .select('*')

    if (folders.length === 0) {
        res.status(404).json({ message: 'No folders found' });
    } else {
        res.status(200).json(folders);
    }
});

router.get('/getTasks', async (req, res) => {
    const uid = 
        req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id;
    if (!uid) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }

    const name = req.query.name;
    
    if (!name) {
        res.status(400).json({ message: 'Name is required' });
        return;
    }

    // 'folders' 테이블에서 현재 요청과 owner와 name이 같은 행을 조회
    // 'tasks' 테이블에서 현재 요청과 owner와 이전에 조회한 folder_id가 같은 행을 조회
    // 단. isCompleted가 0인 행을 먼저 조회, 1인 행은 가장 나중에 뜨게, isCompleted가 같으면 priority가 낮은 순으로 정렬, priority가 같으면 seq가 낮은 순으로 정렬
    const folder_id = await db('folders')
        .where({ owner: uid, name: name })
        .select('id');

    const tasks = await db('tasks')
        .where({ owner: uid, folder_id: folder_id })
        .orderByRaw('isCompleted ASC, priority ASC, seq ASC')
        .select('*')

    if (tasks.length === 0) {
        res.status(404).json({ message: 'No tasks found' });
    } else {
        res.status(200).json(tasks);
    }
});

router.get('/getDailyPlanner', async (req, res) => {
    const uid = 
        req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id;
    if (!uid) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }

    const date = req.query.date;
    
    if (!date) {
        res.status(400).json({ message: 'Date is required' });
        return;
    }

    const tasks = await db('tasks')
        .where({ owner: uid, date: date })
        .orderByRaw('isCompleted ASC, priority ASC, seq ASC')
        .select('*')

    if (tasks.length === 0) {
        res.status(404).json({ message: 'No tasks found' });
    } else {
        res.status(200).json(tasks);
    }
});

router.get('/getDefaultPlanner', async (req, res) => {
    res.redirect('/getPlanner');
});

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

    const date = req.query.date;
    
    if (!date) {
        res.status(400).json({ message: 'Date is required' });
        return;
    }

    const tasks = await db('tasks')
        .where({ owner: uid })
        .andWhere(function(){
            if (date) {
                this.where('date', date)
            }
            else {
                this.whereNull('date')
            }
        })
        .orderByRaw('isCompleted ASC, priority ASC, seq ASC')
        .select('*')

    if (tasks.length === 0) {
        res.status(404).json({ message: 'No tasks found' });
    } else {
        res.status(200).json(tasks);
    }
});

module.exports = router;