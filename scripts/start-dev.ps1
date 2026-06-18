& .\scripts\up-code.ps1
docker compose stop user-management     # outdated container, run `npm run start:dev user-management` to start a new one
Start-Process powershell -ArgumentList "-NoExit", "cd services/platform; npm run start:dev api-gateway"
Start-Process powershell -ArgumentList "-NoExit", "cd services/platform; npm run start:dev user-management"
Start-Process powershell -ArgumentList "-NoExit", "cd services/platform; npm run start:dev chat"
Start-Process powershell -ArgumentList "-NoExit", "cd services/document-processor; py -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "cd services/web-ui; npm run dev"