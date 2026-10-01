// 在 Linux 上无需 Wine：用纯 JS 的 resedit 给 Windows exe 写入图标与版本信息
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const productFilename = context.packager.platformSpecificBuildOptions.executableName || context.packager.appInfo.productFilename;
  const version = context.packager.appInfo.version;
  const exe = path.join(context.appOutDir, `${productFilename}.exe`);
  const ico = path.join(context.packager.projectDir, 'build', 'icon.ico');

  const exeObj = ResEdit.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exeObj);
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(ico));

  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const targets = groups.length ? groups : [{ id: 1, lang: 1033 }];
  for (const g of targets) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries, g.id, g.lang, iconFile.icons.map((i) => i.data)
    );
  }

  const [vi] = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const parts = version.split('.').map((n) => parseInt(n, 10) || 0);
  while (parts.length < 4) parts.push(0);
  vi.setFileVersion(...parts);
  vi.setProductVersion(...parts);
  const langs = vi.getAllLanguagesForStringValues();
  for (const l of langs) {
    vi.setStringValues(l, {
      FileDescription: context.packager.appInfo.productName,
      ProductName: context.packager.appInfo.productName,
      CompanyName: 'kevinyuzekai',
      FileVersion: version,
      ProductVersion: version,
      OriginalFilename: `${productFilename}.exe`,
      InternalName: productFilename,
      LegalCopyright: '© 2026 kevinyuzekai',
    });
  }
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exeObj);
  fs.writeFileSync(exe, Buffer.from(exeObj.generate()));
  console.log(`  • afterPack: icon + version info written to ${path.basename(exe)} (groups: ${targets.map((g) => g.id).join(',')})`);
};
