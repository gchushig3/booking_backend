"""Empaqueta ms-catalog para Azure App Service Linux (rutas con '/')."""
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTRACTS = os.path.join(ROOT, "..", "..", "contracts")
OUT = os.path.join(ROOT, "deploy.zip")


def main() -> None:
    if not os.path.isfile(os.path.join(ROOT, "dist", "main.js")):
        sys.exit("Falta dist/: ejecute 'npm run build' primero.")
    stage = tempfile.mkdtemp(prefix="catalog-azure-")
    try:
        shutil.copytree(os.path.join(ROOT, "dist"), os.path.join(stage, "dist"))
        shutil.copytree(
            os.path.join(ROOT, "node_modules"), os.path.join(stage, "node_modules"), symlinks=True
        )
        for name in ("package.json", "package-lock.json"):
            shutil.copy(os.path.join(ROOT, name), stage)
        os.makedirs(os.path.join(stage, "contracts"))
        shutil.copy(os.path.join(CONTRACTS, "inventory.proto"), os.path.join(stage, "contracts"))
        subprocess.run(
            "npm prune --omit=dev --ignore-scripts --no-audit --no-fund",
            cwd=stage,
            shell=True,
            check=True,
        )
        # El lock no registra la dependencia file: ni sus dependencias.
        subprocess.run(
            "npm install --omit=dev --no-save --ignore-scripts --no-audit --no-fund"
            " ajv@^8.17.1 ajv-formats@^3.0.1 amqp-connection-manager@^4.1.14"
            " amqplib@^0.10.9 @grpc/grpc-js@^1.14.0 @grpc/proto-loader@^0.8.0 pg@^8.16.3",
            cwd=stage,
            shell=True,
            check=True,
        )
        target = os.path.join(stage, "node_modules", "@booking", "infrastructure")
        try:
            os.rmdir(target)
        except OSError:
            shutil.rmtree(target, ignore_errors=True)
        shutil.copytree(
            os.path.join(ROOT, "node_modules", "@booking", "infrastructure"), target
        )
        if os.path.exists(OUT):
            os.remove(OUT)
        with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
            for base, _dirs, files in os.walk(stage):
                for file in files:
                    full = os.path.join(base, file)
                    arc = os.path.relpath(full, stage).replace(os.sep, "/")
                    zf.write(full, arc)
        print(f"{OUT} ({os.path.getsize(OUT) / 1048576:.1f} MB)")
    finally:
        shutil.rmtree(stage, ignore_errors=True)


if __name__ == "__main__":
    main()
