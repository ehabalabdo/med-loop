# 🏥 MED LOOP - Multi-Clinic Management System

A comprehensive clinic management system built with React, TypeScript, and PostgreSQL.

## ✨ Features

- **Multi-Role Access**: Admin, Doctor, Secretary, Lab, Patient Portal
- **Real-time Queue**: Live patient tracking with instant updates (1s polling)
- **EMR System**: Complete electronic medical records
- **Billing**: Invoice generation and payment tracking
- **Appointments**: Schedule and manage patient visits
- **Dental Lab**: Case tracking and management
- **Implant Inventory**: Supply tracking
- **Training Academy**: Course management
- **Multi-language**: Arabic & English
- **Themes**: Dark & Light modes

## 🚀 Quick Start

```bash
# Install
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Run
npm run dev

# Build
npm run build
```

## 🔧 Configuration

### Environment Variables (.env)
```env
VITE_API_URL=https://your-api.com
VITE_DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

### Debug Mode
Enable logging in `services/services.ts`:
```typescript
const DEBUG_MODE = true;
```

## 📊 Architecture

- **Frontend**: React 18 + TypeScript + Vite
- **Database**: PostgreSQL (Neon serverless)
- **Styling**: Tailwind CSS
- **State**: React Context API
- **Routing**: React Router v6

## 🗂️ Project Structure

```
medloop2/
├── components/        # Reusable UI components
├── context/           # React contexts (Auth, Theme, Language)
├── hooks/             # Custom hooks
├── services/          # Business logic & API
├── views/             # Main application views
├── types.ts           # TypeScript definitions
└── App.tsx            # Root component
```

## 🔐 Default Login

- Admin: admin@clinic.com / password
- Doctor: doctor@clinic.com / password
- Secretary: secretary@clinic.com / password

**⚠️ Change these after first login!**

## 🎯 Key Components

### Services
- `services.ts` - Main business logic
- `pgServices.ts` - PostgreSQL operations
- `db.ts` - Database connection

### Views
- `AdminView` - System management
- `DoctorView` - Patient care & EMR
- `ReceptionView` - Registration & queue
- `PatientProfileView` - Patient portal

### Custom Hooks
- `useCompletedPatients()` - Shared patient state across views

## 🐛 Known Issues

- Billing uses mock database (migration pending)
- Data comparison every 1s (optimized with change detection)

## 📈 Performance

- Polling: 1s with intelligent change detection
- Error boundaries for crash prevention
- Optimized re-renders with React hooks
- Efficient PostgreSQL queries

## 🚢 Deployment

### Vercel
```bash
vercel --prod
```

### Manual
```bash
npm run build
# Upload dist/ folder to hosting
```

## 📞 Support

For issues: GitHub Issues  
For questions: Check documentation

## 📄 License

Proprietary - All rights reserved

---

**Version**: 2.0.0  
**Built with** ❤️ **by MED LOOP Team**
