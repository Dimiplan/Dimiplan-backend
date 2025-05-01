-- --------------------------------------------------------
-- 호스트:                          127.0.0.1
-- 서버 버전:                        8.0.41 - MySQL Community Server - GPL
-- 서버 OS:                        Win64
-- HeidiSQL 버전:                  12.10.0.7000
-- --------------------------------------------------------
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;

/*!40101 SET NAMES utf8 */;

/*!50503 SET NAMES utf8mb4 */;

/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;

/*!40103 SET TIME_ZONE='+00:00' */;

/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;

/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;

/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- dimiplan 데이터베이스 구조 내보내기
CREATE DATABASE IF NOT EXISTS `dimiplan` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `dimiplan`;

-- 테이블 dimiplan.chat 구조 내보내기
CREATE TABLE IF NOT EXISTS `chat` (
    `from` int DEFAULT NULL,
    `id` int DEFAULT NULL,
    `message` longtext CHARACTER
    SET
        utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        `owner` text,
        `sender` tinytext
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.
-- 테이블 dimiplan.chat_rooms 구조 내보내기
CREATE TABLE IF NOT EXISTS `chat_rooms` (
    `owner` text NOT NULL,
    `id` int NOT NULL DEFAULT (0),
    `name` text NOT NULL,
    `isProcessing` tinyint NOT NULL DEFAULT (0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.
-- 테이블 dimiplan.folders 구조 내보내기
CREATE TABLE IF NOT EXISTS `folders` (
    `owner` text NOT NULL,
    `id` int DEFAULT (0),
    `from` int DEFAULT NULL,
    `name` varchar(20) NOT NULL DEFAULT ''
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.
-- 테이블 dimiplan.plan 구조 내보내기
CREATE TABLE IF NOT EXISTS `plan` (
    `owner` text NOT NULL,
    `startDate` date DEFAULT NULL,
    `dueDate` date DEFAULT NULL,
    `contents` text,
    `from` int NOT NULL DEFAULT (0),
    `isCompleted` tinyint NOT NULL DEFAULT (0),
    `id` int NOT NULL,
    `priority` int NOT NULL DEFAULT (1)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.
-- 테이블 dimiplan.planner 구조 내보내기
CREATE TABLE IF NOT EXISTS `planner` (
    `owner` text NOT NULL,
    `id` int NOT NULL,
    `from` int NOT NULL DEFAULT (0),
    `isDaily` tinyint NOT NULL DEFAULT (0),
    `name` text NOT NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.
-- 테이블 dimiplan.sessions 구조 내보내기
CREATE TABLE IF NOT EXISTS `sessions` (
    `sid` varchar(255) NOT NULL,
    `sess` json NOT NULL,
    `expired` datetime NOT NULL,
    PRIMARY KEY (`sid`),
    KEY `sessions_expired_index` (`expired`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.
-- 테이블 dimiplan.userid 구조 내보내기
CREATE TABLE IF NOT EXISTS `userid` (
    `owner` text NOT NULL,
    `planId` int NOT NULL DEFAULT (1),
    `folderId` int NOT NULL DEFAULT (1),
    `plannerId` int NOT NULL DEFAULT '1',
    `chatId` int NOT NULL DEFAULT (1),
    `roomId` int NOT NULL DEFAULT (1)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.
-- 테이블 dimiplan.users 구조 내보내기
CREATE TABLE IF NOT EXISTS `users` (
    `id` text NOT NULL,
    `name` text,
    `grade` tinyint DEFAULT NULL,
    `class` tinyint DEFAULT NULL,
    `email` text NOT NULL,
    `profile_image` text NOT NULL,
    PRIMARY KEY (`id` (100))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.
/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;

/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;

/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;

/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
