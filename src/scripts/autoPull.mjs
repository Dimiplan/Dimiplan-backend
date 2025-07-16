import { exec } from "node:child_process";

const logWithTimestamp = (message, level = "INFO") => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
};

const executeGitPull = () => {
  exec("git pull", (error, stdout, stderr) => {
    if (error) {
      logWithTimestamp(`자동 pull 실패: ${error.message}`, "ERROR");
      return;
    }
    if (stderr) {
      logWithTimestamp(`자동 pull 경고: ${stderr}`, "WARN");
    }
    const result = stdout.trim() || "No changes";
    logWithTimestamp(`자동 pull 상태: ${result}`);
  });
};

const PULL_INTERVAL = 30000;

setInterval(executeGitPull, PULL_INTERVAL);
logWithTimestamp(
  "자동 pull 서비스가 시작되었습니다. 30초마다 git pull을 실행합니다.",
);

export { executeGitPull, logWithTimestamp };
