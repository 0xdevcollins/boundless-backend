import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

// eslint-disable-next-line no-unused-vars
type Transformer<T> = (value: string) => T;

export class Config {
  private static instance: Config;

  public readonly NODE_ENV: string;
  public readonly PORT: number;
  public readonly MONGODB_URI: string;
  public readonly JWT_SECRET: string;

  // OAuth
  public readonly GOOGLE_CLIENT_ID: string;
  public readonly GOOGLE_CLIENT_SECRET: string;
  public readonly GITHUB_CLIENT_ID: string;
  public readonly GITHUB_CLIENT_SECRET: string;

  // Email
  public readonly SMTP_HOST: string;
  public readonly SMTP_PORT: number;
  public readonly SMTP_USER: string;
  public readonly SMTP_PASS: string;

  public readonly cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };

  public readonly fileUpload: {
    maxFileSize: number;
    allowedFileTypes: string[];
  };

  public readonly cors: {
    origin: string;
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
  };

  public readonly rateLimit: {
    windowMs: number;
    max: number;
  };

  private constructor() {
    this.NODE_ENV = this.getEnvVariable("NODE_ENV", true);
    this.PORT = this.getEnvVariable("PORT", true, parseInt);
    this.MONGODB_URI = this.getEnvVariable("MONGODB_URI", true);
    this.JWT_SECRET = this.getEnvVariable("JWT_SECRET", true);

    // OAuth
    this.GOOGLE_CLIENT_ID = this.getEnvVariable("GOOGLE_CLIENT_ID", true);
    this.GOOGLE_CLIENT_SECRET = this.getEnvVariable(
      "GOOGLE_CLIENT_SECRET",
      true,
    );
    this.GITHUB_CLIENT_ID = this.getEnvVariable("GITHUB_CLIENT_ID", true);
    this.GITHUB_CLIENT_SECRET = this.getEnvVariable(
      "GITHUB_CLIENT_SECRET",
      true,
    );

    // Email
    this.SMTP_HOST = this.getEnvVariable("SMTP_HOST", true);
    this.SMTP_PORT = this.getEnvVariable("SMTP_PORT", true, parseInt);
    this.SMTP_USER = this.getEnvVariable("SMTP_USER", true);
    this.SMTP_PASS = this.getEnvVariable("SMTP_PASS", true);

    this.cloudinary = {
      cloudName: this.getEnvVariable("CLOUDINARY_CLOUD_NAME", true),
      apiKey: this.getEnvVariable("CLOUDINARY_API_KEY", true),
      apiSecret: this.getEnvVariable("CLOUDINARY_API_SECRET", true),
    };

    this.fileUpload = {
      maxFileSize: this.getEnvVariable("MAX_FILE_SIZE", true, parseInt),
      allowedFileTypes: this.getEnvVariable("ALLOWED_FILE_TYPES", true).split(
        ",",
      ),
    };

    this.cors = {
      origin: this.getEnvVariable("CORS_ORIGIN", true),
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    };

    this.rateLimit = {
      windowMs: this.getEnvVariable("RATE_LIMIT_WINDOW_MS", true, parseInt),
      max: this.getEnvVariable("RATE_LIMIT_MAX", true, parseInt),
    };
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private getEnvVariable<T = string>(
    key: string,
    required = false,
    transform: Transformer<T> = (val) => val as unknown as T,
  ): T {
    const value = process.env[key];
    if (value === undefined || value === "") {
      if (required) {
        console.error(`Missing required environment variable: ${key}`);
        process.exit(1);
      }
      return undefined as unknown as T;
    }
    return transform(value);
  }
}

export const config = Config.getInstance();
