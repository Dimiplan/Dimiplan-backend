const { getUser, isRegistered, updateUser } = require('../../models/userModel');
const express = require('express');
const knex = require('knex')

const router = express.Router();

router.post('/addTask', async (req, res, next) => {
    const { content, date, priority } = req.body;
    const uid =
        req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id;
    if (!uid) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }
    const formattedDate = new Date(date).toISOString().slice(0, 10); // "YYYY-MM-DD"
    // 'tasks' 테이블에서 현재 요청과 owner와 date가 같은 행의 개수를 조회
    const count = await knex('tasks')
        .where({ owner: uid, date: formattedDate })
        .count('* as cnt')
        .then(rows => rows[0].cnt);
    const seq = count + 1; 

    
    try {
        await knex('tasks').insert({
            owner: uid,       // TEXT, 반드시 문자열로 제공
            seq,         // INT
            content,     // TEXT
            date,        // DATE (YYYY-MM-DD 형식의 문자열이나 Date 객체)
            priority,    // INT
            isCompleted: 0  // TINYINT (0 또는 1)
        });
        res.status(200).json({ message: 'Task inserted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Insertion failed' });
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

    const date = req.query.date;
    if (!date) {
        res.status(400).json({ message: 'Date is required' });
        return;
    }

    // 'tasks' 테이블에서 현재 요청과 owner와 date가 같은 행을 조회
    // 단. priority가 낮은 순서로 정렬, priority가 같으면 seq가 낮은 순서로 정렬
    const tasks = await knex('tasks')
        .where({ owner: uid, date })
        .orderBy(['priority', 'seq'])
        .select('*');
    
    if (tasks.length === 0) {
        res.status(404).json({ message: 'No tasks found' });
    } else {
        res.status(200).json(tasks);
    }
});

router.post('/updateTask', async (req, res) => {
    const { seq, date, newContent, newDate, newPriority } = req.body;
    const uid =
        req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id;
    if (!uid) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }
    if (!seq || !date) {
        res.status(400).json({ message: 'Seq and date are required' });
        return;
    }
    if (!newContent && !newDate && !newPriority) {
        res.status(400).json({ message: 'At least one field is required' });
        return;
    }

    const updateData = {};
    if (newContent) updateData.content = newContent;
    if (newDate) updateData.date = newDate;
    if (newPriority) updateData.priority = newPriority;
    try {
        await knex('tasks')
            .where({ owner: uid, date, seq })
            .update(updateData);
        res.status(200).json({ message: 'Task updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Update failed' });
    }
});

router.post('/deleteTask', async (req, res) => {
    const {date, seq} = req.body;
    const uid =
        req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id;
    if (!uid) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }
    if (!date || !seq) {
        res.status(400).json({ message: 'Date and seq are required' });
        return;
    }
    try {
        await knex('tasks')
            .where({ owner: uid, date, seq })
            .del();
        res.status(200).json({ message: 'Task deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Deletion failed' });
    }
});

router.post('/completeTask', async (req, res) => {
    const {date, seq} = req.body;
    const uid =
        req.session &&
        req.session.passport &&
        req.session.passport.user &&
        req.session.passport.user.id;
    if (!uid) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }
    if (!date || !seq) {
        res.status(400).json({ message: 'Date and seq are required' });
        return;
    }
    try {
        await knex('tasks')
            .where({ owner: uid, date, seq })
            .update({ isCompleted: 1 });
        res.status(200).json({ message: 'Task completed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Completion failed' });
    }
});
module.exports = router;