# JCE CONNECT

> Suite d'outils complète pour la réussite des entrepreneurs et talents.

---

## Structure du projet

```
jce-connect/
├── .env.local                  ← Variables d'env (jamais commité)
├── .firebaserc                 ← Projet Firebase cible
├── .gitignore
├── firebase.json               ← Config Firebase Hosting
├── firebase-applet-config.json ← Config SDK Firebase
├── firestore.rules             ← Règles de sécurité Firestore
├── index.html
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx                ← Point d'entrée
    ├── App.tsx                 ← Routes + AuthProvider
    ├── index.css               ← Styles globaux + tokens
    ├── lib/
    │   └── firebase.ts         ← Init Firebase (auth, db, storage)
    ├── types/
    │   └── index.ts            ← Types TypeScript partagés
    ├── hooks/
    │   └── useAuth.ts          ← Context auth + hook useUser()
    ├── components/
    │   └── Layout.tsx          ← Layout principal (à créer)
    └── pages/
        ├── Login.tsx
        ├── Home.tsx
        ├── Events.tsx
        ├── EventWall.tsx
        ├── Business.tsx
        ├── Services.tsx
        ├── Communities.tsx
        ├── Reseau.tsx
        ├── Profile.tsx
        ├── Favorites.tsx
        ├── Tasks.tsx
        ├── Messages.tsx
        └── Notifications.tsx
```

---

## Installation

```bash
# 1. Cloner et installer les dépendances
npm install

# 2. Créer le fichier .env.local (ne jamais commiter ce fichier)
cp .env.example .env.local
# → Remplir GEMINI_API_KEY avec ta vraie clé
```

---

## Développement local

```bash
npm run dev
```

---

## Déploiement Firebase Hosting

```bash
# TOUJOURS dans cet ordre :

# 1. Builder le projet
npm run build

# 2. Déployer sur Firebase
firebase deploy

# Ou en une ligne :
npm run build && firebase deploy
```

> ⚠️ Ne jamais faire `firebase deploy` sans `npm run build` avant — le dossier `dist/` doit être à jour.

---

## Déployer uniquement les règles Firestore

```bash
firebase deploy --only firestore:rules
```

---

## Variables d'environnement

| Variable         | Description                        | Requis |
|------------------|------------------------------------|--------|
| `GEMINI_API_KEY` | Clé API Google Gemini              | ✅     |

> Les variables Firebase (apiKey, projectId…) sont dans `firebase-applet-config.json` et ne nécessitent pas de `.env`.

---

## Règles importantes

- **SQLite** (`better-sqlite3`) → **local uniquement**, jamais en production Firebase
- **Firestore** → base de données de production
- **Firebase Storage** → fichiers (logos, covers, CV PDF…)
- Le hook `useUser()` remplace partout `useContext(UserContext)`

---

## Importer auth dans tes composants

```tsx
import { useUser } from '@/src/hooks/useAuth';

export default function MonComposant() {
  const { user, profile, loading } = useUser();
  // ...
}
```

## Importer Firebase

```tsx
import { db, auth, storage } from '@/src/lib/firebase';
```
