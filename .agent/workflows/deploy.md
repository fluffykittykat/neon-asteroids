---
description: Full deployment process - git sync, docker build, and deploy to Google Cloud Run
---

# Deployment Workflow

Run these steps after any change is ready to ship.

// turbo-all

## 1. Stage and commit all changes
```powershell
cmd /c git add -A && git commit -m "<descriptive commit message>"
```

## 2. Pull latest from remote and rebase
```powershell
cmd /c git pull --rebase
```
If there are unstaged changes blocking the pull, stash first:
```powershell
cmd /c git stash && git pull --rebase && git stash pop
```

## 3. Push to remote
```powershell
cmd /c git push
```

## 4. Build Docker image locally (smoke test)
```powershell
cmd /c docker build -t neon-asteroids .
```

## 5. Deploy to Google Cloud Run
```powershell
cmd /c gcloud run deploy neon-asteroids --source . --port 8080 --region us-central1 --allow-unauthenticated --set-env-vars VITE_GEMINI_API_KEY=AIzaSyDJ59L7nRuoVZ0b0kh9FXahXA1XtSAGKuM
```
This command builds the container in Cloud Build and deploys it to Cloud Run.

## 6. Verify deployment
Confirm the Service URL is returned and the app is accessible at:
https://neon-asteroids-210721664554.us-central1.run.app
