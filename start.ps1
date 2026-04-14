# Complete setup and startup script for Library Management System

Write-Host "🚀 Setting up and starting Library Management System..." -ForegroundColor Green

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir 'library-backend'
$frontendDir = Join-Path $scriptDir 'library-frontend'

# Function to check if command exists
function Test-Command {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Check Python installation
Write-Host "📋 Checking Python installation..." -ForegroundColor Yellow
if (!(Test-Command python)) {
    Write-Host "❌ Python is not installed. Please install Python 3.8+ first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Python found" -ForegroundColor Green

# Check Node.js installation
Write-Host "📋 Checking Node.js installation..." -ForegroundColor Yellow
if (!(Test-Command node) -or !(Test-Command npm)) {
    Write-Host "❌ Node.js or npm is not installed. Please install Node.js first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js and npm found" -ForegroundColor Green

# Setup backend
Write-Host "🔧 Setting up backend..." -ForegroundColor Yellow

# Create virtual environment if it doesn't exist
$venvPath = Join-Path $backendDir 'venv'
if (!(Test-Path $venvPath)) {
    Write-Host "   Creating virtual environment..." -ForegroundColor Cyan
    & python -m venv $venvPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create virtual environment" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Virtual environment created" -ForegroundColor Green
} else {
    Write-Host "   ✅ Virtual environment already exists" -ForegroundColor Green
}

# Create .env file if it doesn't exist
$envFile = Join-Path $backendDir '.env'
if (!(Test-Path $envFile)) {
    Write-Host "   Creating .env file..." -ForegroundColor Cyan
    $envContent = @"
DATABASE_URL=sqlite:///./library.db
SECRET_KEY=09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
"@
    Set-Content -Path $envFile -Value $envContent -Encoding UTF8
    Write-Host "   ✅ .env file created" -ForegroundColor Green
} else {
    Write-Host "   ✅ .env file already exists" -ForegroundColor Green
}

# Install backend dependencies
Write-Host "   Installing backend dependencies..." -ForegroundColor Cyan
$activateScript = Join-Path $venvPath 'Scripts\Activate.ps1'
$installCommand = "& '$activateScript'; Set-Location '$backendDir'; pip install -r requirements.txt"
$installResult = Invoke-Expression $installCommand
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Backend dependencies installed" -ForegroundColor Green

# Setup frontend
Write-Host "🌐 Setting up frontend..." -ForegroundColor Yellow

# Create .env file if it doesn't exist
$frontendEnvFile = Join-Path $frontendDir '.env'
if (!(Test-Path $frontendEnvFile)) {
    Write-Host "   Creating frontend .env file..." -ForegroundColor Cyan
    $frontendEnvContent = "REACT_APP_API_BASE_URL=http://localhost:8000/api/v1"
    Set-Content -Path $frontendEnvFile -Value $frontendEnvContent -Encoding UTF8
    Write-Host "   ✅ Frontend .env file created" -ForegroundColor Green
} else {
    Write-Host "   ✅ Frontend .env file already exists" -ForegroundColor Green
}

# Install frontend dependencies
$nodeModulesPath = Join-Path $frontendDir 'node_modules'
if (!(Test-Path $nodeModulesPath)) {
    Write-Host "   Installing frontend dependencies..." -ForegroundColor Cyan
    Set-Location $frontendDir
    $npmResult = & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "   ✅ Frontend dependencies already installed" -ForegroundColor Green
}

# Start servers
Write-Host "🚀 Starting servers..." -ForegroundColor Green

$backendCommand = "& { Set-Location '$backendDir'; & '$venvPath\\Scripts\\python.exe' -m uvicorn app.main:app --reload --port 8000 }"
$frontendCommand = "& { Set-Location '$frontendDir'; npm start }"

Write-Host "Starting backend server window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-Command', $backendCommand

Start-Sleep -Seconds 3
Write-Host "Starting frontend server window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-Command', $frontendCommand

Write-Host ""
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host "📊 Backend: http://localhost:8000" -ForegroundColor Cyan
Write-Host "💻 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "📋 API docs: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default admin account:" -ForegroundColor Yellow
Write-Host "Username: admin" -ForegroundColor White
Write-Host "Password: admin123" -ForegroundColor White
