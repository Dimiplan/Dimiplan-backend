const child_process = require('node:child_process');
setInterval(() => { child_process.exec('git pull'); }, 60000);
