CYBERSHIELD AI
=============

PRESENTATION
------------
CyberShield AI est une application web de cybersécurité composée d'une interface utilisateur, d'une API et d'un module d'intelligence artificielle. Elle permet d'analyser des URL et des données réseau, de consulter les alertes et l'historique, et de gérer les comptes et les intégrations disponibles.

FONCTIONNEMENT
--------------
1. L'utilisateur accède au tableau de bord React et se connecte ou crée un compte.
2. L'interface communique avec l'API FastAPI, à l'adresse configurée dans VITE_API_URL. Les routes protégées utilisent un jeton Bearer.
3. L'API analyse les URL et textes soumis afin d'estimer le risque de phishing, avec les modèles locaux et les listes ou flux de menaces configurés.
4. L'analyse d'intrusion accepte des événements réseau ou un fichier CSV de flux. Le modèle IDS chargé depuis IA/models classe les flux et renvoie un résumé.
5. Les résultats et l'historique sont enregistrés dans la base de données. Le tableau de bord permet aussi de gérer les utilisateurs, la messagerie de support, les abonnements et les flux de renseignements sur les menaces.
6. La surveillance automatique du phishing relance périodiquement l'analyse des URL enregistrées lorsque la fonction est activée dans le tableau de bord et que l'onglet reste ouvert.
7. Des systèmes externes peuvent transmettre des événements au webhook POST /webhooks/events lorsqu'un secret est configuré. Le corps doit être signé avec HMAC-SHA256 selon les instructions du README.md.

La surveillance automatique des URL vérifie leur réputation phishing ; elle ne réalise pas de scan complet des sites ou serveurs. L'analyse IDS traite les données réseau fournies. Les intégrations de réseaux sociaux et cloud nécessitent les accès officiels et autorisations appropriés.

TECHNOLOGIES
------------
Interface : React 19, TypeScript, Vite 8, React Router, Tailwind CSS 4 et composants Base UI.
Backend : Python, FastAPI, Uvicorn, Pydantic Settings, SQLAlchemy, jetons JWT et hachage des mots de passe.
Données : SQLite pour le développement (les pilotes PostgreSQL et MySQL sont aussi présents dans les dépendances).
IA et données : scikit-learn, XGBoost, NumPy, Pandas, Joblib et PyArrow. Le dossier IA comprend les scripts de préparation, d'entraînement, d'évaluation et d'explicabilité SHAP, ainsi que des modèles entraînés.
Paiements : intégration Stripe configurée au moyen de variables d'environnement.

PRÉREQUIS
---------
- Git
- Python 3.10 ou plus récent (Python 3.13 est indiqué dans la documentation du module IA).
- Node.js compatible avec Vite 8 (Node.js 20.19+ ou 22.12+ recommandé) et npm.
- Espace disque suffisant pour les dépendances et jeux de données IA.

INSTALLATION - WINDOWS (PowerShell)
-----------------------------------
Depuis la racine du dépôt :

1. Configurer le backend

   cd Backend
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   Copy-Item .env.example .env

   Modifier Backend/.env avant le démarrage. Pour une base SQLite locale, utiliser par exemple :
   DATABASE_URL=sqlite:///./cybershield.db
   SECRET_KEY=<longue-cle-aleatoire>
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   SUPERADMIN_EMAIL=<adresse-administrateur>
   SUPERADMIN_PASSWORD=<mot-de-passe-fort>
   FRONTEND_URL=http://localhost:5173

   Les variables Stripe, URLHAUS_AUTH_KEY et INTEGRATION_WEBHOOK_SECRET ne sont nécessaires que pour les fonctionnalités correspondantes. Ne pas publier le fichier .env ni ses secrets.

2. Installer et démarrer le frontend dans un autre terminal

   cd Frontend
   npm ci
   Copy-Item .env.example .env
   npm run dev

   Frontend/.env contient VITE_API_URL=http://127.0.0.1:8000 par défaut.

3. Démarrer l'API dans le premier terminal, depuis le dossier Backend avec l'environnement virtuel activé

   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

   Ouvrir l'adresse affichée par Vite (généralement http://localhost:5173). La documentation interactive de l'API est disponible sur http://127.0.0.1:8000/docs et l'état de santé sur http://127.0.0.1:8000/health.

INSTALLATION - LINUX / macOS
----------------------------
Depuis la racine du dépôt, dans un premier terminal :

   cd Backend
   python3 -m venv .venv
   source .venv/bin/activate
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   cp .env.example .env

Renseigner les variables du fichier Backend/.env comme dans la section Windows, puis démarrer l'API :

   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

Dans un autre terminal :

   cd Frontend
   npm ci
   cp .env.example .env
   npm run dev

MODULE IA (OPTIONNEL POUR UTILISER LES MODÈLES LIVRÉS)
-----------------------------------------------------
Les modèles pré-entraînés sont déjà présents dans IA/models et IA/phishing/models ; le backend les utilise sans qu'il soit nécessaire de relancer l'entraînement. Pour exécuter les scripts d'analyse ou d'entraînement, créer un environnement Python séparé :

   cd IA
   python -m venv .venv

Activer cet environnement (Windows : .\.venv\Scripts\Activate.ps1 ; Linux/macOS : source .venv/bin/activate), puis installer :

   python -m pip install --upgrade pip
   pip install -r requirements.txt

Les jeux de données et notebooks se trouvent dans IA/datasets et IA/notebooks. Certains traitements peuvent demander beaucoup de mémoire et d'espace disque.

CONFIGURATION ET DÉPANNAGE
-------------------------
- Le backend lit ses paramètres depuis Backend/.env ; DATABASE_URL et SECRET_KEY doivent être renseignés.
- Au démarrage, les tables manquantes sont créées dans la base. Si SUPERADMIN_EMAIL et SUPERADMIN_PASSWORD sont définis, un compte superadministrateur est créé ou promu avec cette adresse.
- Si l'interface ne joint pas l'API, vérifier que les deux serveurs sont démarrés et que VITE_API_URL correspond à l'adresse du backend. Après modification d'une variable VITE_*, redémarrer Vite.
- En développement, le backend autorise actuellement les requêtes CORS de toutes origines. Restreindre cette configuration avant tout déploiement en production.
- Pour un déploiement public, utiliser HTTPS, des secrets uniques et forts, une base de données correctement configurée, des origines CORS restreintes et un serveur de production adapté. Ne pas utiliser le serveur Vite de développement en production.
- Les commandes npm run build et npm run lint sont disponibles dans Frontend.

STRUCTURE DU DÉPÔT
------------------
Backend/ : API FastAPI, routes, services, modèles de données et configuration.
Frontend/ : interface React/TypeScript construite avec Vite.
IA/ : données, scripts de machine learning, modèles, évaluation et explicabilité.
README.md : précisions sur le périmètre et l'utilisation des webhooks.

