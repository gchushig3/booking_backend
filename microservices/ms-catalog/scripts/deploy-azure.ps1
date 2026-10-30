# Despliega ms-catalog (Atracciones) en Azure App Service Linux B1.
# Requisitos: az login hecho, npm run build ejecutado y deploy.zip generado
# (python scripts\package-azure.py). Los secretos se leen de .env; no se imprimen.
param(
  [string]$App = 'booking-atracciones-api',
  [string]$ResourceGroup = 'rg-booking-atracciones',
  [string]$Plan = 'plan-booking-atracciones',
  [string]$Location = 'eastus',
  [string]$Runtime = 'NODE:24-lts'
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Get-EnvValue([string]$Key) {
  $line = Select-String -Path .env -Pattern "^$Key=" | Select-Object -First 1
  if (-not $line) { throw "Falta $Key en .env" }
  $line.Line.Substring($Key.Length + 1)
}
function Invoke-Az { & az @args; if ($LASTEXITCODE -ne 0) { throw "az $($args -join ' ') fallo" } }

Write-Host 'Regiones permitidas por politicas:'
az policy assignment list --query "[].{n:displayName,p:parameters.listOfAllowedLocations.value}" -o json
Invoke-Az provider register --namespace Microsoft.Web --wait

Invoke-Az group create --name $ResourceGroup --location $Location -o none
Invoke-Az appservice plan create --name $Plan --resource-group $ResourceGroup --location $Location --sku B1 --is-linux -o none
Invoke-Az webapp create --name $App --resource-group $ResourceGroup --plan $Plan --runtime $Runtime -o none

Invoke-Az webapp config set --name $App --resource-group $ResourceGroup --always-on true --min-tls-version 1.2 --startup-file 'node dist/main.js' -o none
Invoke-Az webapp update --name $App --resource-group $ResourceGroup --https-only true -o none
$siteId = az webapp show --name $App --resource-group $ResourceGroup --query id -o tsv
Invoke-Az resource update --ids "$siteId/config/web" --set properties.healthCheckPath=/api/v3/atracciones/health -o none

$settings = @{
  NODE_ENV                           = 'production'
  SCM_DO_BUILD_DURING_DEPLOYMENT     = 'false'
  WEBSITES_CONTAINER_START_TIME_LIMIT = '600'
  BOOKING_REST_STOCK_URL             = 'https://booking-puce.brazilsouth.cloudapp.azure.com/api/v3/inventory/stock'
  BOOKING_GRPC_URL                   = 'booking-puce.brazilsouth.cloudapp.azure.com:50051'
  DATABASE_URL                       = Get-EnvValue 'DATABASE_URL'
  AMQP_URL                           = Get-EnvValue 'AMQP_URL'
  AMQP_QUEUE                         = 'ms_catalog.events'
  AMQP_PREFETCH                      = '10'
  CATALOG_EVENTS_QUEUE               = 'booking.catalog.events'
  AMQP_AUDIT_QUEUE                   = 'booking.audit.events'
  AMQP_CATALOG_QUEUE                 = 'catalog.reviews'
  INVENTORY_GRPC_URL                 = 'booking-puce.brazilsouth.cloudapp.azure.com:50051'
  INVENTORY_GRPC_TLS                 = 'false'
  INVENTORY_PROTO_PATH               = '/home/site/wwwroot/contracts/inventory.proto'
  INVENTORY_SERVICE_ID               = 'NODE_ATR_DILAN'
  IDENTITY_BASE_URL                  = 'http://localhost:3011/api/v2'
  BOOKING_API_KEY                    = -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
}
$file = Join-Path $env:TEMP 'azure-settings.json'
$settings | ConvertTo-Json | Set-Content -Path $file -Encoding utf8
try {
  Invoke-Az webapp config appsettings set --name $App --resource-group $ResourceGroup --settings "@$file" -o none
} finally { Remove-Item $file -Force }

Invoke-Az webapp deploy --resource-group $ResourceGroup --name $App --src-path deploy.zip --type zip --async true

Invoke-Az resource update --resource-group $ResourceGroup --name scm --namespace Microsoft.Web `
  --resource-type basicPublishingCredentialsPolicies --parent "sites/$App" --set properties.allow=true -o none
az webapp deployment list-publishing-profiles --name $App --resource-group $ResourceGroup --xml | Set-Content publish_profile.xml -Encoding utf8
Write-Host 'publish_profile.xml generado: guardelo como secreto AZURE_WEBAPP_PUBLISH_PROFILE en GitHub y borrelo.'

Write-Host "Validacion: https://$App.azurewebsites.net/api/v3/atracciones/health"
