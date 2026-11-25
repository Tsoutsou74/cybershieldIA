# 🤖 CyberShield AI - Machine Learning Module

## Description

Ce dossier contient le module d'Intelligence Artificielle de **CyberShield AI**.

Il est responsable de :

- Prétraitement des données
- Entraînement des modèles de Machine Learning
- Évaluation des performances
- Sauvegarde des modèles entraînés
- Prédiction des cyberattaques
- Explication des prédictions (XAI)

Le backend FastAPI utilise uniquement les modèles entraînés générés par ce module.

---

# Structure

```text
AI/
│
├── datasets/          # Jeux de données
├── preprocessing/     # Nettoyage et préparation des données
├── training/          # Entraînement des modèles
├── prediction/        # Prédictions
├── evaluation/        # Évaluation des modèles
├── explainability/    # IA explicable (SHAP)
├── models/            # Modèles entraînés (.pkl)
├── notebooks/         # Expérimentations Jupyter
├── experiments/       # Tests de nouveaux algorithmes
├── utils/             # Fonctions utilitaires
├── requirements.txt
└── README.md
```

---

# Technologies

- Python 3.13+
- Scikit-Learn
- Pandas
- NumPy
- Joblib
- SHAP
- Matplotlib
- Plotly

---

# Installation

Créer un environnement virtuel :

```bash
python -m venv venv
```

Activer l'environnement :

Windows

```bash
venv\Scripts\activate
```

Linux / macOS

```bash
source venv/bin/activate
```

Installer les dépendances :

```bash
pip install -r requirements.txt
```

---

# Workflow

1. Importer un dataset
2. Nettoyer les données
3. Prétraiter les données
4. Entraîner le modèle
5. Évaluer les performances
6. Sauvegarder le modèle
7. Utiliser le modèle dans le backend FastAPI

---

# Algorithmes

Les modèles qui pourront être utilisés :

- Random Forest
- Decision Tree
- Logistic Regression
- XGBoost
- LightGBM
- CatBoost

---

# Dataset

Exemple de datasets :

- CIC IDS 2017
- UNSW-NB15
- NSL-KDD

---

# Auteur

Projet de mémoire de Licence 3

Nom du projet : **CyberShield AI**

Développé avec Python et FastAPI.