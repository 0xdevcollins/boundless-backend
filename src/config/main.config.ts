// eslint-disable-next-line no-unused-vars
type Transformer<T> = (value: string) => T;

export class Config {
  private static instance: Config;

  public readonly NODE_ENV: string;
  public readonly PORT: number | undefined;
  public readonly MONGODB_URI: string;
  public readonly JWT_SECRET: string;

  // OAuth Credentials
  public readonly GOOGLE_CLIENT_ID: string;
  public readonly GOOGLE_CLIENT_SECRET: string;
  public readonly GITHUB_CLIENT_ID: string;
  public readonly GITHUB_CLIENT_SECRET: string;

  // Email Service Credentials
  public readonly SMTP_HOST: string;
  public readonly SMTP_PORT: number;
  public readonly SMTP_USER: string;
  public readonly SMTP_PASS: string;

  private constructor() {
    this.NODE_ENV = this.getEnvVariable("NODE_ENV", true);
    this.PORT = this.getEnvVariable("PORT", false, parseInt);
    this.MONGODB_URI = this.getEnvVariable("MONGODB_URI", true);
    this.JWT_SECRET = this.getEnvVariable("JWT_SECRET", true);

    // OAuth Credentials
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

    // Email Service Credentials
    this.SMTP_HOST = this.getEnvVariable("SMTP_HOST", true);
    this.SMTP_PORT = this.getEnvVariable("SMTP_PORT", true, parseInt);
    this.SMTP_USER = this.getEnvVariable("SMTP_USER", true);
    this.SMTP_PASS = this.getEnvVariable("SMTP_PASS", true);
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private getEnvVariable<T = string>(
    key: string,
    required: boolean = false,
    transform: Transformer<T> = (value) => value as unknown as T,
  ): T {
    const value = process.env[key];
    if (value === undefined || value === "") {
      if (required) {
        console.error(`Environment variable ${key} is missing or empty.`);
        process.exit(1);
      }
      return undefined as unknown as T;
    }
    return transform(value);
  }
}

export const config = Config.getInstance();
