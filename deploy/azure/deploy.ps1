<#
Despliega los 12 microservicios en Azure Container Apps.
Uso (desde la raiz del repo):
  .\deploy\azure\deploy.ps1 -Tag v1                  # todos
  .\deploy\azure\deploy.ps1 -Tag v2 -Only ms-catalog # uno solo
Los secretos se leen de microservices\<servicio>\.env (ignorados por git) y de
deploy\azure\.secrets.json (BOOKING_API_KEY, INVENTORY_SYNC_API_KEY, JWT_KEYRING_JSON).
#>
param(
  [string]$Tag = 'v1',
  [string[]]$Only = @(),
  [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'
$az = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
$root = (Resolve-Path "$PSScriptRoot\..\..").Path
$rg = 'rg-viveloecuador'
$envName = 'cae-vivelo-vnet'
$loc = 'brazilsouth'
$acr = 'acrbookingbackend'
$acrServer = "$acr.azurecr.io"
$secrets = Get-Content "$PSScriptRoot\.secrets.json" -Raw | ConvertFrom-Json

function Get-DotEnv($dir, $key) {
  $line = Get-Content "$root\microservices\$dir\.env" | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if (-not $line) { throw "Falta $key en $dir\.env" }
  return $line.Substring($key.Length + 1).Trim()
}

if (-not (& $az group exists -n $rg | ConvertFrom-Json)) { & $az group create -n $rg -l $loc -o none }
if (-not (& $az containerapp env list -g $rg --query "[?name=='$envName'].name" -o tsv)) {
  # Sin VNet Azure crea un entorno "Express" que no soporta HTTP/2 (gRPC).
  & $az network vnet create -g $rg -n vnet-vivelo -l $loc --address-prefixes 10.20.0.0/16 --subnet-name snet-aca --subnet-prefixes 10.20.0.0/23 -o none
  & $az network vnet subnet update -g $rg --vnet-name vnet-vivelo -n snet-aca --delegations Microsoft.App/environments -o none
  $subnet = & $az network vnet subnet show -g $rg --vnet-name vnet-vivelo -n snet-aca --query id -o tsv
  & $az containerapp env create -g $rg -n $envName -l $loc --enable-workload-profiles true --infrastructure-subnet-resource-id $subnet -o none
}
$domain = & $az containerapp env show -g $rg -n $envName --query properties.defaultDomain -o tsv
function Url($app) { "https://$app.$domain" }
$grpcHost = "ms-inventory.${domain}:443"

# n=nombre, d=carpeta, p=puerto HTTP, ext=ingreso publico, amqp=usa RabbitMQ
$services = @(
  @{ n='ms-identity'; d='ms_identity'; p=8080; ext=$true; amqp=$false; env=@(
      'SMTP_ENABLED=false','JWT_ISSUER=urn:descubreec:identity','JWT_ACCESS_TTL_SECONDS=900','BCRYPT_ROUNDS=12',
      'AUTH_LOGIN_LIMIT=5','AUTH_RECOVERY_LIMIT=3') },
  @{ n='ms-inventory'; d='ms_inventory'; p=3017; ext=$true; amqp=$true; env=@(
      'SAGA_EXCHANGE=booking.saga.v1','AMQP_AUDIT_QUEUE=booking.audit.events','GRPC_HOST=0.0.0.0','GRPC_PORT=50051',
      'INVENTORY_PROTO_PATH=/app/contracts/inventory.proto','INVENTORY_SERVICE_ID=NODE_ATR_DILAN') },
  @{ n='ms-catalog'; d='ms-catalog'; p=8080; ext=$true; amqp=$true; env=@(
      'AMQP_QUEUE=ms_catalog.events','AMQP_PREFETCH=10','CATALOG_EVENTS_QUEUE=booking.catalog.events',
      'AMQP_AUDIT_QUEUE=booking.audit.events','AMQP_CATALOG_QUEUE=catalog.reviews',
      "INVENTORY_GRPC_URL=$grpcHost",'INVENTORY_GRPC_TLS=true','INVENTORY_PROTO_PATH=/app/contracts/inventory.proto',
      'INVENTORY_SERVICE_ID=NODE_ATR_DILAN') },
  @{ n='ms-cart'; d='ms_cart'; p=8080; ext=$false; amqp=$true; env=@(
      'SAGA_EXCHANGE=booking.saga.v1','AMQP_AUDIT_QUEUE=booking.audit.events',"CATALOG_BASE_URL=$(Url 'ms-catalog')/api/v2",
      "INVENTORY_GRPC_URL=$grpcHost",'INVENTORY_GRPC_TLS=true','INVENTORY_PROTO_PATH=/app/contracts/inventory.proto',
      'INVENTORY_SERVICE_ID=NODE_ATR_DILAN','RESERVATION_TTL_SECONDS=900','PAYMENT_ALLOW_TEST_PAYLOADS=false') },
  @{ n='ms-payment'; d='ms_payment'; p=8080; ext=$false; amqp=$true; env=@(
      'SAGA_EXCHANGE=booking.saga.v1','AMQP_AUDIT_QUEUE=booking.audit.events','SAGA_SIMULATION_ENABLED=true',
      'PAYMENT_SIMULATION_FAILURE_RATE=0.35','PAYMENT_ALLOW_TEST_PAYLOADS=false',
      "INVENTORY_GRPC_URL=$grpcHost",'INVENTORY_GRPC_TLS=true','INVENTORY_PROTO_PATH=/app/contracts/inventory.proto') },
  @{ n='ms-audit'; d='ms_audit'; p=8080; ext=$false; amqp=$true; env=@('AMQP_PREFETCH=20','AMQP_AUDIT_QUEUES=booking.audit.events') },
  @{ n='ms-refund'; d='ms_refund'; p=8080; ext=$false; amqp=$true; env=@('AMQP_PREFETCH=10','SAGA_EXCHANGE=booking.saga.v1','AMQP_AUDIT_QUEUE=booking.audit.events') },
  @{ n='ms-review'; d='ms_review'; p=8080; ext=$false; amqp=$true; env=@('AMQP_CATALOG_QUEUE=catalog.reviews','AMQP_AUDIT_QUEUE=booking.audit.events') },
  @{ n='ms-support'; d='ms_support'; p=8080; ext=$false; amqp=$false; env=@() },
  @{ n='ms-billing-profile'; d='ms_billing_profile'; p=8080; ext=$false; amqp=$false; env=@() },
  @{ n='ms-location'; d='ms_location'; p=8080; ext=$false; amqp=$false; env=@() },
  @{ n='ms-coupon'; d='ms_coupon'; p=8080; ext=$false; amqp=$false; env=@() }
)
if ($Only.Count) { $services = $services | Where-Object { $Only -contains $_.n } }

& $az acr login -n $acr -o none
& $az acr update -n $acr --admin-enabled true -o none
$acrUser = & $az acr credential show -n $acr --query username -o tsv
$acrPass = & $az acr credential show -n $acr --query 'passwords[0].value' -o tsv
$amqp = Get-DotEnv 'ms-catalog' 'AMQP_URL'

foreach ($s in $services) {
  $image = "$acrServer/$($s.n):$Tag"
  if (-not $SkipBuild) {
    Write-Host "== build $($s.n)"
    docker build -q -f "$root\microservices\$($s.d)\Dockerfile" -t $image $root | Out-Null
    if ($LASTEXITCODE) { throw "build fallo: $($s.n)" }
    docker push -q $image | Out-Null
    if ($LASTEXITCODE) { throw "push fallo: $($s.n)" }
  }
  $dbUrl = (Get-DotEnv $s.d 'DATABASE_URL') -replace '&channel_binding=require',''
  $secretArgs = @("db-url=$dbUrl", "booking-key=$($secrets.BOOKING_API_KEY)")
  $envArgs = @('NODE_ENV=production','APP_ENV=production',"PORT=$($s.p)",'DB_POOL_MAX=5',
    "IDENTITY_BASE_URL=$(Url 'ms-identity')/api/v2",'DATABASE_URL=secretref:db-url','BOOKING_API_KEY=secretref:booking-key')
  if ($s.amqp) { $secretArgs += "amqp-url=$amqp"; $envArgs += 'AMQP_URL=secretref:amqp-url' }
  if ($s.n -eq 'ms-identity') { $secretArgs += "jwt-keyring=$($secrets.JWT_KEYRING_JSON.Replace('"','\"'))"; $envArgs += 'JWT_KEYRING_JSON=secretref:jwt-keyring' }
  if ($s.n -eq 'ms-inventory') { $secretArgs += "sync-key=$($secrets.INVENTORY_SYNC_API_KEY)"; $envArgs += 'INVENTORY_SYNC_API_KEY=secretref:sync-key' }
  $envArgs += $s.env

  $ingress = if ($s.n -eq 'ms-inventory') { @('--ingress','external','--target-port','50051','--transport','http2') }
             elseif ($s.ext) { @('--ingress','external','--target-port',$s.p) }
             else { @('--ingress','internal','--target-port',$s.p) }

  Write-Host "== deploy $($s.n)"
  $exists = & $az containerapp list -g $rg --query "[?name=='$($s.n)'].name" -o tsv
  if (-not $exists) {
    & $az containerapp create -g $rg -n $s.n --environment $envName --image $image `
      --registry-server $acrServer --registry-username $acrUser --registry-password $acrPass `
      @ingress --min-replicas 1 --max-replicas 1 --cpu 0.25 --memory 0.5Gi `
      --secrets @secretArgs --env-vars @envArgs -o none
  } else {
    & $az containerapp secret set -g $rg -n $s.n --secrets @secretArgs -o none
    & $az containerapp update -g $rg -n $s.n --image $image --set-env-vars @envArgs -o none
  }
}

Write-Host "`nURLs:"
& $az containerapp list -g $rg --query "[].{app:name,fqdn:properties.configuration.ingress.fqdn}" -o table
