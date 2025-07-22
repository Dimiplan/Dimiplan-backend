import { $ } from "bun";

const logWithTimestamp = (message, level = "INFO") => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
};

const executeGitPull = async () => {
    const result = await $`git pull`.nothrow();
    if (result.exitCode !== 0) {
        logWithTimestamp(`자동 pull 실패: ${result.stderr}`, "ERROR");
        return;
    } else if (result.stderr) {
        logWithTimestamp(`자동 pull 경고: ${result.stderr}`, "WARN");
        return;
    }
    logWithTimestamp(`자동 pull 성공: ${result.stdout.trim() || "No changes"}`);
};

const PULL_INTERVAL = 10000;

setInterval(executeGitPull, PULL_INTERVAL);
logWithTimestamp(
    "자동 pull 서비스가 시작되었습니다. 10초마다 git pull을 실행합니다.",
);
