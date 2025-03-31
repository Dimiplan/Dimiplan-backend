const { getUser, isRegistered, updateUser } = require('../../models/userModel');
const express = require('express');
const db = require('../../config/db');
const router = express.Router();

router.post('/addTask', async (req, res, next) => {
    const { content, date, priority } = req.body;
    console.log(content, date, priority);
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
    let seq;
    // 'userSeq' 테이블에서 현재 요청과 owner와 date가 같은 행이 있는지 확인, 만약 있으면 seq 값을 가져오고, 없으면 owner, date, seq=0로 된 행을 insert
    const count = await db('userSeq')
        .where({ owner: uid, date: formattedDate })
        .count('seq as count')
        .first();
    if (count.count > 0) {
        const seqResult = await db('userSeq')
            .where({ owner: uid, date: formattedDate })
            .select('seq')
            .first();
        seq = seqResult.seq;
    } else {
        const seqResult = await db('userSeq')
            .insert({ owner: uid, date: formattedDate, seq: 0 })
        seq = 0
    }
    seq++;
    // 'userSeq' 테이블에서 seq 값을 1 추가해 업데이트
    await db('userSeq')
        .where({ owner: uid, date: formattedDate })
        .update({ seq });   

    try {
        await db('tasks').insert({
            owner: uid,       // TEXT, 반드시 문자열로 제공
            seq,         // INT
            content,     // TEXT
            date: formattedDate,        // DATE (YYYY-MM-DD 형식의 문자열이나 Date 객체)
            priority,    // INT
            isCompleted: 0  // TINYINT (0 또는 1)
        });
        // Insert된 task의 seq 반환
        res.status(200).json({ message: 'Task inserted', seq });
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

    const formattedDate = new Date(date).toISOString().slice(0, 10); // "YYYY-MM-DD"


    // 'tasks' 테이블에서 현재 요청과 owner와 date가 같은 행을 조회
    // 단. isCompleted가 0인 행을 먼저 조회, 1인 행은 가장 나중에 뜨게, isCompleted가 같으면 priority가 낮은 순으로 정렬, priority가 같으면 seq가 낮은 순으로 정렬
    const tasks = await db('tasks')
        .where({ owner: uid, date: formattedDate })
        .orderByRaw('isCompleted ASC, priority ASC, seq ASC')
        .select('seq', 'content', 'date', 'priority', 'isCompleted');

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
    const formattedDate = new Date(date).toISOString().slice(0, 10); // "YYYY-MM-DD"

    const updateData = {};
    if (newContent) updateData.content = newContent;
    if (newDate) {
        const formattedNewDate = new Date(newDate).toISOString().slice(0, 10); // "YYYY-MM-DD"
        updateData.date = formattedNewDate;
    } 

    if (newPriority) updateData.priority = newPriority;
    try {
        await db('tasks')
            .where({ owner: uid, date: formattedDate, seq })
            .update(updateData);
        res.status(200).json({ message: 'Task updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Update failed' });
    }
});

router.post('/removeTask', async (req, res) => {
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
    const formattedDate = new Date(date).toISOString().slice(0, 10); // "YYYY-MM-DD"

    try {
        await db('tasks')
            .where({ owner: uid, date: formattedDate, seq })
            .del();
        res.status(200).json({ message: 'Task deleted' });
        console.log(uid, formattedDate, seq);
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
    const formattedDate = new Date(date).toISOString().slice(0, 10); // "YYYY-MM-DD"

    try {
        await db('tasks')
            .where({ owner: uid, date: formattedDate, seq })
            .update({ isCompleted: 1 });
        res.status(200).json({ message: 'Task completed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Completion failed' });
    }
});

router.get('/isCompleted', async (req, res) => {
    const { date, seq } = req.query;
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
    const formattedDate = new Date(date).toISOString().slice(0, 10); // "YYYY-MM-DD"
    try {
        const task = await db('tasks')
            .where({ owner: uid, date: formattedDate, seq })
            .select('isCompleted')
            .first();
        if (task) {
            res.status(200).json({ isCompleted: task.isCompleted });
        } else {
            res.status(404).json({ message: 'Task not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching task' });
    }
});
module.exports = router;