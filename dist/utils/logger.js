"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggerStream = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = require("path");
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
winston_1.default.addColors(logColors);
// Define log format
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`));
// Define which transports the logger must use
const transports = [
    // Console transport
    new winston_1.default.transports.Console({
        format: logFormat,
    }),
    // File transport for errors
    new winston_1.default.transports.File({
        filename: (0, path_1.join)(process.cwd(), '.aaswe', 'logs', 'error.log'),
        level: 'error',
        format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    }),
    // File transport for all logs
    new winston_1.default.transports.File({
        filename: (0, path_1.join)(process.cwd(), '.aaswe', 'logs', 'combined.log'),
        format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    }),
];
// Create the logger
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: logLevels,
    transports,
    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston_1.default.transports.File({
            filename: (0, path_1.join)(process.cwd(), '.aaswe', 'logs', 'exceptions.log'),
        }),
    ],
    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston_1.default.transports.File({
            filename: (0, path_1.join)(process.cwd(), '.aaswe', 'logs', 'rejections.log'),
        }),
    ],
});
// Create a stream object for HTTP request logging
exports.loggerStream = {
    write: (message) => {
        logger.http(message.trim());
    },
};
exports.default = logger;
//# sourceMappingURL=logger.js.map