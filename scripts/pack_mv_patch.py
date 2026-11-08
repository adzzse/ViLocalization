"""Package an MV build's allowlisted payload and verify the reopened ZIP."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import zipfile


def pack(directory):
    root = Path(directory).resolve()
    manifest = json.loads((root / 'patch-manifest.json').read_text(encoding='utf-8'))
    payload = {}
    for name, item in manifest['files'].items():
        relative = PurePosixPath(name)
        if '\\' in name or ':' in name or relative.is_absolute() or '..' in relative.parts or not name.startswith('www/'):
            raise ValueError('Unsafe patch path: ' + name)
        file = (root / name).resolve()
        if not file.is_relative_to(root):
            raise ValueError('Patch path escapes build: ' + name)
        data = file.read_bytes()
        if hashlib.sha256(data).hexdigest() != item['sha256']:
            raise ValueError('Patch payload hash changed: ' + name)
        payload[name] = data
    for name in ('patch-manifest.json', 'INSTALL.txt'):
        payload[name] = (root / name).read_bytes()
    output = root / 'patch.zip'
    with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(payload.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    with zipfile.ZipFile(output) as archive:
        if archive.namelist() != sorted(payload):
            raise ValueError('Archive member list differs from allowlist')
        for name, data in payload.items():
            if archive.read(name) != data:
                raise ValueError('Archive payload differs: ' + name)
    return output


if __name__ == '__main__':
    print(pack(sys.argv[1]))
