import dotenv from "dotenv";

dotenv.config();

interface Config {
  port: number;
  mongoUri: string;
  jwt: {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
  };
  email: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
  };
  frontendUrl: string;
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  github: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  cors: {
    origin: string;
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };
  stellar: {
    testnet: {
      rpcUrl: string;
      horizonUrl: string;
      networkPassphrase: string;
    };
    mainnet: {
      rpcUrl: string;
      horizonUrl: string;
      networkPassphrase: string;
    };
    futurenet: {
      rpcUrl: string;
      horizonUrl: string;
      networkPassphrase: string;
    };
  };
}

export const config: Config = {
  port: parseInt(process.env.PORT || "3000"),
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/boundless",
  jwt: {
    accessTokenSecret:
      process.env.JWT_ACCESS_TOKEN_SECRET || "your-access-token-secret",
    refreshTokenSecret:
      process.env.JWT_REFRESH_TOKEN_SECRET || "your-refresh-token-secret",
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || "15m",
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || "7d",
  },
  email: {
    host: process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || "587"),
    secure:
      process.env.SMTP_SECURE === "true" || process.env.EMAIL_SECURE === "true",
    user: process.env.SMTP_USER || process.env.EMAIL_USER || "",
    password: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || "",
    from: process.env.EMAIL_FROM || "noreply@boundlessfi.xyz",
  },
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      "http://localhost:3000/auth/google/callback",
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    redirectUri:
      process.env.GITHUB_REDIRECT_URI ||
      "http://localhost:3000/auth/github/callback",
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },
  stellar: {
    testnet: {
      rpcUrl:
        process.env.STELLAR_TESTNET_RPC_URL ||
        "https://soroban-testnet.stellar.org",
      horizonUrl:
        process.env.STELLAR_TESTNET_HORIZON_URL ||
        "https://horizon-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
    mainnet: {
      rpcUrl:
        process.env.STELLAR_MAINNET_RPC_URL ||
        "https://soroban-mainnet.stellar.org",
      horizonUrl:
        process.env.STELLAR_MAINNET_HORIZON_URL ||
        "https://horizon.stellar.org",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    },
    futurenet: {
      rpcUrl:
        process.env.STELLAR_FUTURENET_RPC_URL ||
        "https://soroban-futurenet.stellar.org",
      horizonUrl:
        process.env.STELLAR_FUTURENET_HORIZON_URL ||
        "https://horizon-futurenet.stellar.org",
      networkPassphrase: "Test SDF Future Network ; October 2022",
    },
  },
};
