#!/bin/sh
set -eu
case "$POSTGRES_DB" in
  ms_identity|ms_identity_test) ;;
  *) echo 'Identity bootstrap: database not allowed' >&2; exit 1 ;;
esac
cd /identity-schema
sha256sum --check SHA256SUMS
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --no-psqlrc \
  --set ON_ERROR_STOP=on --single-transaction --file=001-identity.sql
