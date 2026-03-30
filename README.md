# 🚗 DépanNow API

Backend REST API pour **DépanNow**, une marketplace de dépannage automobile qui met en relation des automobilistes en panne avec des dépanneurs disponibles.

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Runtime | Node.js |
| Framework | Express |
| Base de données | PostgreSQL |
| Auth | JWT (7 jours) |
| Sécurité passwords | bcrypt (salt: 12) |
| Temps réel | Socket.io *(Sprint 2)* |

---

## Installation

### Prérequis
- Node.js 18+
- PostgreSQL 14+

### 1. Cloner le repo
```bash
git clone https://github.com/moha-317/depannow-api.git
cd depannow-api
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configurer l'environnement
```bash
cp .env.example .env
# Éditer .env avec vos valeurs
```

### 4. Créer la base de données
```bash
psql -U postgres -c "CREATE DATABASE depannow;"
psql -U postgres -d depannow -f schema.sql
```

### 5. Démarrer le serveur
```bash
# Développement
node src/server.js

# Avec nodemon (auto-reload)
npx nodemon src/server.js
```

---

## Endpoints Sprint 1

### Auth

| Méthode | URL | Description | Auth |
|--------|-----|-------------|------|
| POST | `/api/auth/register` | Inscription | ❌ |
| POST | `/api/auth/login` | Connexion | ❌ |
| GET | `/api/users/me` | Profil connecté | ✅ JWT |

### Notifications

| Méthode | URL | Description | Auth |
|--------|-----|-------------|------|
| GET | `/api/notifications` | Liste des notifs | ✅ JWT |
| PUT | `/api/notifications/:id/read` | Marquer comme lue | ✅ JWT |

### Health

| Méthode | URL | Description |
|--------|-----|-------------|
| GET | `/health` | Statut de l'API |

---

## Exemples de requêtes

### Inscription
```http
POST /api/auth/register
Content-Type: application/json

{
  "full_name": "Mohamed Dupont",
  "email": "mohamed@example.com",
  "phone": "+33612345678",
  "password": "motdepasse123",
  "role": "client"
}
```

### Connexion
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "mohamed@example.com",
  "password": "motdepasse123"
}
```

### Profil (JWT requis)
```http
GET /api/users/me
Authorization: Bearer <votre_token_jwt>
```

### Notifications
```http
GET /api/notifications
Authorization: Bearer <votre_token_jwt>
```

---

## Modèle financier

| Partie | Pourcentage |
|--------|-------------|
| Commission DépanNow | 7% |
| Reversement dépanneur | 93% |

---

## Structure du projet

```
/src
├── config/
│   └── db.js                    # Connexion PostgreSQL (Pool)
├── controllers/
│   ├── auth.controller.js       # register, login, getMe
│   └── notification.controller.js
├── middlewares/
│   └── auth.js                  # Vérification JWT
├── models/
│   ├── user.model.js            # Requêtes SQL users
│   └── notification.model.js   # Requêtes SQL notifications
├── routes/
│   ├── auth.routes.js
│   └── notification.routes.js
├── services/                    # Sprint 2+
└── utils/                       # Sprint 2+
schema.sql                       # Schéma BDD complet (7 tables)
.env.example                     # Template variables d'environnement
```

---

## Roadmap

- [x] **Sprint 1** — Auth JWT, Profil, Notifications
- [ ] **Sprint 2** — Service requests, Offers, Socket.io temps réel
- [ ] **Sprint 3** — Paiements Stripe, Reviews, Dashboard

---

*DépanNow — Le dépannage, simplifié.* 🚗⚡
