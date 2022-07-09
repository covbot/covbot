import { linkBinsOfPackages } from '@pnpm/link-bins';
import { resolve, dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const main = async () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pathToPackage = resolve(
        __dirname,
        '..',
        'node_modules',
        '@moonrepo',
        'cli',
        'package.json'
    );

    const output = await readFile(pathToPackage);
    const packageJson = JSON.parse(output.toString());
    packageJson.bin.moon = 'moon.exe';

    await linkBinsOfPackages(
        [
            {
                manifest: packageJson,
                location: dirname(pathToPackage),
            },
        ],
        resolve(__dirname, '..', 'node_modules', '.bin'),
        {
            warn: (message) => console.warn(message),
        }
    );
};

main();
