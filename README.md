# Thufu Deploy

**ISDP-inspired Survey & Field Audit Platform**

Multi-tenant SaaS platform for field survey management — inspired by Huawei's ISDP (Integrated Service Delivery Platform).

---

## Architecture

```
thufu-deploy/
├── backend/          Node.js + Express + TypeScript API
├── admin/           React + Vite admin dashboard
└── mobile/          React Native / Expo mobile app
```

## Core Features (ISDP-Inspired)

| Feature | Description |
|---------|-------------|
| **Three-Screen Model** | Command Dashboard / Review Screen / Field Screen |
| **Survey Builder** | Multi-section forms with 10+ question types |
| **Photo Evidence** | Multi-photo capture per field, GPS tagging |
| **AI Review Layer** | Photo quality check, anomaly detection |
| **Offline Mobile App** | IndexedDB queue, background sync |
| **Multi-Tenant** | tenant_id on every table, role-based access |
| **Analytics** | Completion rates, heat maps, export to PDF/Excel |

## Current Survey Templates

- **Ground Equipment Scope** (ground_info) — site infra, tower, power, cabinets, slab
- **DCDB Power Audit** (dcdb_info) — DC distribution box, RRU/AAU cabling, earthing
- **Tower Equipment Scope** (tower_info) — antennas, RRUs, azimuth, heights

## Quick Start

```bash
npm install
npm run dev:backend   # API on :3001
npm run dev:admin     # Dashboard on :5173
```

## Environment

Copy `.env.example` in `backend/` to `.env` and configure:

```
PORT=3001
DATABASE_URL=mysql://user:pass@localhost:3306/thufu_deploy
JWT_SECRET=your-secret-here
UPLOAD_DIR=./uploads
```
