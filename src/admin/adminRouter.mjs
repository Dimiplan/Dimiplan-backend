/**
 * AdminJS Dashboard Router
 * Provides administrative interface with secured access
 */
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { ComponentLoader } from 'adminjs';
import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import logger from '../utils/logger.mjs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import express from 'express';

// Import Knex adapter
import { Database, Resource } from '@adminjs/sql';

// Models
import db from '../config/db.mjs';
import { hashUserId } from '../utils/cryptoUtils.mjs';

// Register the SQL adapter with AdminJS
AdminJS.registerAdapter({
  Database,
  Resource
});

// Get current file directory (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom dashboard components
const componentLoader = new ComponentLoader();
const Components = {
  Dashboard: componentLoader.add('Dashboard', path.join(__dirname, './components/dashboard.jsx')),
  LogViewer: componentLoader.add('LogViewer', path.join(__dirname, './components/logViewer.jsx'))
};

// Helper to get log file stats
const getLogFiles = () => {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    return [];
  }

  return fs.readdirSync(logDir)
    .filter(file => file.endsWith('.log'))
    .map(file => {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        path: filePath,
        size: (stats.size / 1024).toFixed(2) + ' KB',
        modified: stats.mtime
      };
    })
    .sort((a, b) => b.modified - a.modified);
};

// Read log file content
const readLogFile = (filePath, limit = 1000) => {
  if (!fs.existsSync(filePath)) {
    return { error: 'File not found' };
  }

  try {
    // Read the last part of the file (most recent logs)
    const fileSize = fs.statSync(filePath).size;
    const readSize = Math.min(fileSize, 1024 * 1024); // Max 1MB at a time
    const buffer = Buffer.alloc(readSize);
    
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, readSize, fileSize - readSize);
    fs.closeSync(fd);
    
    const content = buffer.toString('utf8');
    
    // Split by lines and return the last 'limit' lines
    const lines = content.split(/\r?\n/).filter(Boolean);
    const limitedLines = lines.slice(-limit);
    
    // Parse log entries if they are in JSON format
    const entries = limitedLines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return { message: line, timestamp: new Date().toISOString() };
      }
    });
    
    return { entries };
  } catch (error) {
    logger.error(`Error reading log file: ${error.message}`);
    return { error: error.message };
  }
};

// Dashboard handler - provides data for the dashboard
const dashboardHandler = async () => {
  try {
    // Get log files information
    const logFiles = getLogFiles();
    
    // Get basic database stats
    const userCount = await db('users').count('* as count').first();
    const plannerCount = await db('planner').count('* as count').first();
    const taskCount = await db('plan').count('* as count').first();
    const chatRoomsCount = await db('chat_rooms').count('* as count').first();
    
    // Get recent log entries
    const combinedLogPath = path.join(process.cwd(), 'logs', 'combined.log');
    const recentLogs = readLogFile(combinedLogPath, 10);
    
    return {
      stats: {
        users: userCount ? userCount.count : 0,
        planners: plannerCount ? plannerCount.count : 0,
        tasks: taskCount ? taskCount.count : 0,
        chatRooms: chatRoomsCount ? chatRoomsCount.count : 0
      },
      logFiles,
      recentLogs: recentLogs.entries || []
    };
  } catch (error) {
    logger.error(`Dashboard handler error: ${error.message}`);
    return { error: error.message };
  }
};

// Log file handler - returns content of a specific log file
const logFileHandler = async (request, response, context) => {
  try {
    const { params } = context;
    const fileName = params.fileName;
    const filePath = path.join(process.cwd(), 'logs', fileName);
    
    // Security check - ensure the file is within logs directory
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(path.join(process.cwd(), 'logs'))) {
      return { error: 'Invalid file path' };
    }
    
    const limit = parseInt(params.limit || '1000', 10);
    return readLogFile(filePath, limit);
  } catch (error) {
    logger.error(`Log file handler error: ${error.message}`);
    return { error: error.message };
  }
};

// Define resources using Knex adapter
const resources = [
  {
    resource: new Resource({ db, database: new Database(db, {type: "mysql"}), table: 'users' }),
    options: {
      properties: {
        id: { isVisible: true },
        name: { isVisible: true },
        grade: { isVisible: true },
        class: { isVisible: true },
        email: { isVisible: true },
        profile_image: { isVisible: true },
        created_at: { isVisible: true },
        updated_at: { isVisible: true }
      },
      actions: {
        new: { isVisible: false },
        delete: { isVisible: false }
      }
    }
  },
  {
    resource: new Resource({ db, database: new Database(db, {type: "mysql"}), table: 'planner' }),
    options: {
      properties: {
        owner: { isVisible: true },
        id: { isVisible: true },
        isDaily: { isVisible: true },
        name: { isVisible: true },
        created_at: { isVisible: true },
        updated_at: { isVisible: true }
      }
    }
  },
  {
    resource: new Resource({ db, database: new Database(db, {type: "mysql"}), table: 'plan' }),
    options: {
      properties: {
        owner: { isVisible: true },
        id: { isVisible: true },
        from: { isVisible: true },
        contents: { isVisible: true },
        startDate: { isVisible: true },
        dueDate: { isVisible: true },
        isCompleted: { isVisible: true },
        priority: { isVisible: true },
        created_at: { isVisible: true },
        updated_at: { isVisible: true }
      }
    }
  },
  {
    resource: new Resource({ db, database: new Database(db, {type: "mysql"}), table: 'chat_rooms' }),
    options: {
      properties: {
        owner: { isVisible: true },
        id: { isVisible: true },
        name: { isVisible: true },
        isProcessing: { isVisible: true },
        created_at: { isVisible: true },
        updated_at: { isVisible: true }
      }
    }
  }
];

// Custom pages
const pages = {
  logs: {
    component: Components.LogViewer,
    handler: logFileHandler
  }
};

/**
 * Initialize AdminJS router
 * @param {Object} app - Express application
 * @returns {Object} - AdminJS instance and router
 */
const initAdminRouter = async (app) => {
  // Set up Redis session store (reuse existing Redis connection)
  const redisClient = createClient({ url: 'redis://127.0.0.1:6379' });
  await redisClient.connect().catch(err => {
    logger.error('Admin Redis connection error:', err);
    throw err;
  });

  const redisStore = new RedisStore({
    client: redisClient,
    prefix: 'dimiplan:admin:',
  });

  const adminOptions = {
    resources,
    componentLoader,
    dashboard: {
      component: Components.Dashboard,
      handler: dashboardHandler
    },
    pages,
    rootPath: '/admin',
    branding: {
      companyName: 'Dimiplan Admin',
      logo: '/admin/logo.png',
      favicon: '/admin/favicon.ico'
    }
  };

  const admin = new AdminJS(adminOptions);

  // Set up authentication for admin panel
  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate: async (email, password) => {
        // Admin credentials should be stored securely in environment variables
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@dimiplan.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        if (email === adminEmail && password === adminPassword) {
          return { email: adminEmail };
        }
        return null;
      },
      cookieName: 'dimiplan.admin',
      cookiePassword: process.env.ADMIN_COOKIE_PASSWORD || 'secure-admin-password-12345'
    },
    {
      store: redisStore,
      resave: false,
      saveUninitialized: false,
      secret: process.env.ADMIN_SESSION_SECRET || 'secure-admin-session-12345',
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      },
      name: 'dimiplan.admin.sid'
    }
  );

  // Serve static files for admin
  app.use('/admin/assets', express.static(path.join(__dirname, 'public')));

  // Watch for component changes in development
  if (process.env.NODE_ENV === 'development') {
    admin.watch();
  }

  return { admin, adminRouter };
};

export default initAdminRouter;