Write-Host "🎯 Starting Distributed Order Aggregator System"

# Step 1: Run DB init
psql -U postgres -d orderdb -f scripts/init.sql

# Step 2: Start backend
Start-Process powershell -ArgumentList "npm run dev"

# Step 3: Wait for server & Sync stock
Start-Sleep -Seconds 3
npm run sync

# Step 4: Start order worker
Start-Process powershell -ArgumentList "npm run worker"

Write-Host "✅ All systems running!"
