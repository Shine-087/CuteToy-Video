export const logger = {
  info(message: string, data?: unknown) {
    log("info", message, data);
  },
  warn(message: string, data?: unknown) {
    log("warn", message, data);
  },
  error(message: string, data?: unknown) {
    log("error", message, data);
  }
};

function log(level: "info" | "warn" | "error", message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const suffix = data === undefined ? "" : ` ${JSON.stringify(data)}`;
  console[level](`[${timestamp}] [${level}] ${message}${suffix}`);
}
