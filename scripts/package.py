import os
import zipfile

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
zip_path = os.path.join(root, "gemini-temp-chat-toggle.zip")

EXCLUDE_DIRS = {
    "node_modules", ".git", "tests", "dev", "scripts"
}
EXCLUDE_FILES = {
    "package.json", "package-lock.json", ".gitignore",
    ".web-ext-config.cjs", "gemini-temp-chat-toggle.zip"
}

print(f"Building clean release zip at {zip_path}...")

with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for dirpath, dirnames, filenames in os.walk(root):
        # Filter directories in-place to avoid recursing into them
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]

        for f in filenames:
            if f in EXCLUDE_FILES or f.endswith(".zip") or f.endswith(".xpi"):
                continue
            full_path = os.path.join(dirpath, f)
            rel_path = os.path.relpath(full_path, root)
            zf.write(full_path, rel_path)
            print(f"  + {rel_path}")

print(f"\n✓ Package ready: {zip_path} ({os.path.getsize(zip_path)} bytes)")
