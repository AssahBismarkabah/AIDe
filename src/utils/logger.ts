import winston from 'winston';
import { join } from 'path';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(logColors);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: logFormat,
  }),
  // File transport for errors
  new winston.transports.File({
    filename: join(process.cwd(), '.aaswe', 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
  // File transport for all logs
  new winston.transports.File({
    filename: join(process.cwd(), '.aaswe', 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  transports,
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: join(process.cwd(), '.aaswe', 'logs', 'exceptions.log'),
    }),
  ],
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: join(process.cwd(), '.aaswe', 'logs', 'rejections.log'),
    }),
  ],
});

// Create a stream object for HTTP request logging
export const loggerStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger;