#!/bin/sh
set -eu
case "$POSTGRES_DB" in
  ms_catalog|ms_catalog_test) ;;
  *) echo 'Catalog bootstrap: database not allowed' >&2; exit 1 ;;
esac
cd /catalog-schema
sha256sum --check SHA256SUMS
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --no-psqlrc \
  --set ON_ERROR_STOP=on --single-transaction --file=001-catalog.sql
