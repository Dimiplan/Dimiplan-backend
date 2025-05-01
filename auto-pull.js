const child_process = require("node:child_process");
setInterval(() => {
  const timestamp = new Date().toISOString();
  child_process.exec("git pull", (error, stdout, stderr) => {
    if (error) {
      console.log(`[${timestamp}] 자동 pull 실패: ${error.message}`);
      return;
    }
    if (stderr) {
      console.log(`[${timestamp}] 자동 pull 경고: ${stderr}`);
    }
    console.log(
      `[${timestamp}] 자동 pull 상태: ${stdout.trim() || "No changes"}`,
    );
  });
}, 60000);
console.log(`[${new Date().toISOString()}] 자동 pull 시작됨`);
