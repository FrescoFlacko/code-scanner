export class ScannerError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ScannerError";
  }
}

export class UserError extends ScannerError {
  constructor(message: string, code: string = "USER_ERROR") {
    super(message, code);
    this.name = "UserError";
  }
}

export class GitError extends UserError {
  constructor(message: string) {
    super(message, "GIT_ERROR");
    this.name = "GitError";
  }
}

export class ConfigError extends UserError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class FileSystemError extends ScannerError {
  constructor(message: string) {
    super(message, "FS_ERROR");
    this.name = "FileSystemError";
  }
}
