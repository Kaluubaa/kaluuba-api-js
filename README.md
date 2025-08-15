# Kaluuba API

A secure Web3 authentication and wallet management API built with Node.js, Express, and PostgreSQL. Features encrypted private key storage, smart account integration, and comprehensive user management.

## Features

- 🔐 **Secure Authentication** - JWT-based auth with email verification
- 👛 **Smart Wallet Management** - Auto-generated wallets with Circle smart accounts
- 🛡️ **Private Key Encryption** - AES-256-GCM encryption with scrypt key derivation
- 📧 **Email Services** - Professional email templates with SMTP support
- ✅ **Input Validation** - Comprehensive validation with detailed error messages
- 🔗 **Blockchain Integration** - Base network support with Viem and Ethers.js
- 📊 **Standardized Responses** - Consistent API response format
- 🏗️ **Clean Architecture** - Separation of concerns with service layer pattern

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with Sequelize ORM  
- **Authentication**: JWT, bcrypt
- **Blockchain**: Ethers.js, Viem, Circle Modular Wallets
- **Encryption**: Node.js Crypto (AES-256-GCM + scrypt)
- **Email**: Nodemailer
- **Validation**: Custom validation service
- **Environment**: ES Modules

## 📋 Prerequisites

- Node.js 16+ 
- PostgreSQL 12+
- SMTP email service (Gmail, Outlook, etc.)
- Base network RPC endpoint

## ⚡ Quick Setup

### 1. Clone and Install
```bash
git clone https://github.com/Kaluubaa/kaluuba-api-js.git
cd kaluuba-api-js
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Database Setup
```bash
# Create PostgreSQL database
createdb kaluuba
```

### 4. Generate Secrets
```bash
# Generate JWT secret
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env

# Generate encryption secret
echo "ENCRYPTION_SECRET=$(openssl rand -base64 32)" >> .env
```

### 5. Start Development Server
```bash
npm run dev

# Run migrations (if migrations dont run automatically)
npx sequelize-cli db:migrate
```

Server runs on: `http://localhost:3030/api/v1`

## 🔧 Environment Variables

### Required Configuration

```bash
# Server Configuration
BASE_URL=http://localhost:3030/api
PORT=3030
NODE_ENV=development
API_VERSION=v1

# Database (PostgreSQL)
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kaluuba
DB_USER=postgres
DB_PASSWORD=your_strong_password

# Security (Generate with OpenSSL)
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_SECRET=your_encryption_secret_here
JWT_EXPIRES_IN=24h

# Email Service (SMTP)
EMAIL_FROM=your-email@gmail.com
EMAIL_PASSWORD=your_app_specific_password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# Blockchain
RPC_URL=https://sepolia.base.org
```

### Optional Configuration
```bash
# Database Connection Pool
DB_SSL=false
DB_MIN_CONNECTIONS=2
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000

# API Settings
API_RATE_LIMIT=100
LOG_LEVEL=info
EMAIL_SECURE=465
```

## 📚 API Documentation

### Base URL
```
http://localhost:3030/api/v1
```

### API Endpoints

```
https://solanadevs.postman.co/workspace/kaluuba~b96c0838-b583-4dba-9765-b63b377c9eae/request/20323840-bc0b8f23-1b87-46bf-9d55-036b2bc4bef7?action=share&source=copy-link&creator=20323840
```

## 🏗️ Project Structure

```
kaluuba-api/
├── controllers/          # Route handlers
│   ├── AuthController.js
│   └── WalletController.js
├── models/              # Database models  
│   ├── index.js
│   └── user.js
├── services/            # Business logic
│   ├── EmailService.js
│   ├── EncryptionService.js
│   ├── SmartAccountService.js
│   ├── UserService.js
│   └── ValidationService.js
├── routes/              # API routes
│   └── auth.js
├── utils/               # Utility functions
│   └── ApiResponse.js
├── config/              # Configuration
│   └── config.js
├── migrations/          # Database migrations
└── app.js              # Express application
```

## 🔒 Security Features

### Private Key Protection
- **AES-256-GCM encryption** with authenticated encryption
- **Scrypt key derivation** with unique salts per user
- **Multi-layer security** (user password + user ID + environment secret)
- **Secure key rotation** support

### Authentication Security
- **bcrypt password hashing** (12 rounds)
- **JWT tokens** with configurable expiration
- **Email verification** required for activation
- **Input validation** and sanitization
- **Rate limiting** support

### Database Security
- **Unique constraints** on email and username
- **Input validation** at model level
- **Connection pooling** with timeout controls
- **SSL support** for production databases

## 🧪 Development

### Install Dependencies
```bash
npm install
```

### Development Scripts
```bash
npm run dev          # Start with nodemon
npm start           # Start production server
npm run lint        # Code linting (if configured)
```

### Database Operations
```bash
# Generate migration
npx sequelize-cli migration:generate --name migration-name

# Run migrations
npx sequelize-cli db:migrate

# Rollback migration
npx sequelize-cli db:migrate:undo
```


## 🚀 Production Deployment

### Environment Setup
```bash
NODE_ENV=production
DB_SSL=true
# Use strong, unique secrets
JWT_SECRET=$(openssl rand -base64 64)
ENCRYPTION_SECRET=$(openssl rand -base64 32)
```

### Security Checklist
- [ ] Use HTTPS in production
- [ ] Enable database SSL
- [ ] Set up proper CORS policies  
- [ ] Implement rate limiting
- [ ] Use environment-specific RPC URLs
- [ ] Enable comprehensive logging
- [ ] Set up monitoring and alerts
- [ ] Regular security audits

### Recommended Infrastructure
- **Database**: PostgreSQL with connection pooling
- **Reverse Proxy**: Nginx with SSL termination
- **Process Manager**: PM2 for Node.js clustering
- **Monitoring**: Winston + external monitoring service
- **Caching**: Redis for session storage

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check existing documentation
- Review the security recommendations

## 🔮 Roadmap

- [ ] Multi-factor authentication (2FA)
- [ ] Hardware wallet integration  
- [ ] Advanced wallet operations
- [ ] Comprehensive test suite
- [ ] GraphQL API option
- [ ] Multi-chain support

---

Built with ❤️ for secure Web3 applications