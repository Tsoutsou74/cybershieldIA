# CyberShieldAI

Plateforme de sécurité destinée aux entreprises : surveillance des sites et serveurs qu'elles administrent, et suivi de leur présence sur les réseaux sociaux et services cloud.

## Périmètre

### Sites et serveurs de l'entreprise
- Collecter des journaux et alertes depuis des intégrations autorisées (hébergeur, pare-feu/WAF, serveur, DNS).
- Détecter des comportements suspects et regrouper les événements en incidents.
- Alerter les opérateurs avec les éléments utiles à l'investigation.
- Limiter la surveillance aux actifs enregistrés par l'entreprise ou pour lesquels elle a une autorisation explicite.

### Réseaux sociaux et services cloud
- Connecter les comptes de l'entreprise par les API officielles et les autorisations accordées par leurs administrateurs.
- Surveiller les événements que ces API exposent, selon les possibilités du fournisseur.
- Rechercher les usurpations de marque et les URL de phishing dans des flux et sources autorisés.
- L'infrastructure interne de Facebook, Google, Microsoft et des autres fournisseurs n'est accessible qu'à leurs propres équipes.

## Mises à jour automatiques

Les règles de détection et les listes de menaces pourront être actualisées depuis des sources configurées. Les changements devront être authentifiés, journalisés et réversibles. Les mises à jour du logiciel seront distinctes des mises à jour de données, avec contrôle de version et procédure de retour arrière.

## Première version (MVP)

1. Inventaire des entreprises, utilisateurs et actifs surveillés.
2. Tableau de bord des événements et alertes.
3. Réception de journaux depuis une première intégration choisie (par exemple un serveur ou un WAF).
4. Connexion d'un compte social professionnel via son API officielle et les accès administrateur requis.
5. Analyse de signalements d'URL et règles de détection actualisables.
6. Journal d'audit, gestion des secrets et rôles d'accès.

## Informations nécessaires pour activer les intégrations

- Les URL des sites et le fournisseur d'hébergement ou de WAF utilisé.
- Les services sociaux/cloud à surveiller et la confirmation que l'entreprise en est administratrice.
- Les accès développeur/API fournis par les plateformes concernées.
- Le canal de notification souhaité (courriel, Slack, autre).

Aucun mot de passe ni jeton secret ne doit être ajouté au dépôt. Les secrets seront configurés dans un gestionnaire de secrets ou des variables d'environnement protégées.

## Codes de connexion par Gmail

Le login envoie un code à six chiffres à l'adresse du compte après validation du mot de passe. Le code expire après cinq minutes et ne peut être utilisé qu'une fois. Pour activer l'envoi, configurez dans l'environnement du backend `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`, `GMAIL_SMTP_HOST=smtp.gmail.com` et `GMAIL_SMTP_PORT=587`. `GMAIL_ADDRESS` est le Gmail expéditeur; le code est envoyé à l'adresse du compte qui se connecte.

Pour Gmail, utilisez un mot de passe d'application Google, jamais le mot de passe normal du compte. Google exige que la validation en deux étapes soit activée pour créer un mot de passe d'application. Consultez la [procédure officielle de Google](https://support.google.com/mail/answer/185833?hl=fr). Ajoutez ces valeurs à `Backend/.env` ou au gestionnaire de secrets de déploiement; ne les commitez pas.

## Surveillance automatique et webhooks

Dans le tableau de bord, « Surveillance auto » relance l'analyse des URL ajoutées toutes les 15 secondes tant que l'onglet reste ouvert et la surveillance active. Chaque cycle est enregistré dans l'historique du compte. Cette vérification concerne la réputation phishing des URL; elle ne scanne pas le site ni son infrastructure. L'analyse IDS s'applique aux flux fournis sous forme de CSV ou d'événement réseau.

Pour activer le point d'entrée d'intégration, définissez `INTEGRATION_WEBHOOK_SECRET` avec une valeur aléatoire longue dans l'environnement du backend, puis redémarrez l'API. Envoyez les événements à `POST /webhooks/events` avec `X-CyberShield-Signature: sha256=<hex HMAC-SHA256 du corps HTTP brut>`. Corps pris en charge :

```json
{"provider":"meta","type":"url","target":"https://example.com/login"}
```

```json
{"provider":"cloudflare","type":"intrusion","source_ip":"203.0.113.8","features":{"Flow Duration":1200,"SYN Flag Count":1}}
```

La requête signée crée une entrée d'analyse sans utilisateur associé, visible dans la supervision superadmin. Les webhooks natifs des fournisseurs doivent passer par un relais qui vérifie d'abord leur signature propre, convertit leur payload et calcule la signature CyberShield. Cette route ne connecte pas automatiquement un compte Facebook et ne lit que les événements que le fournisseur autorise à transmettre.
