require('dotenv').config();

module.exports = {
    DB_HOST: process.env.DB_HOST || "localhost",
    DB_USER: process.env.DB_USER || "root",
    DB_PASSWORD: process.env.DB_PASSWORD || "",
    dbName: process.env.DB_NAME || "bitirme",
    PORT: process.env.PORT || 8001,
    ACCESS_JWT_SECRET: process.env.ACCESS_JWT_SECRET || "access_secret_key_123",
    REFRESH_JWT_SECRET: process.env.REFRESH_JWT_SECRET || "refresh_secret_key_123"
};
