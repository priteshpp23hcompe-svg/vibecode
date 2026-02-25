import { WebContainer } from '@webcontainer/api';

export interface ProjectAnalysis {
    type: "node" | "static" | "python" | "docker" | "unknown";
    installCommand: [string, string[]] | null;
    preInstallCommands: [string, string[]][];
    startCommand: [string, string[]] | null;
    detectedFiles: string[];
    reason: string;
    packageManager: "npm" | "yarn" | "pnpm" | "bun" | null;
    shouldRemoveLockfile: boolean;
}

/**
 * Analyzes the files in the WebContainer to detect the project type and
 * determine the appropriate install and start commands.
 * 
 * Adopts bolt.diy patterns:
 * - Non-interactive flags (--yes --no-audit --no-fund)
 * - Lockfile-based package manager detection
 * - Pre-install browserslist update to prevent interactive prompts
 */
export async function analyzeProject(instance: WebContainer): Promise<ProjectAnalysis> {
    try {
        const files = await instance.fs.readdir('/');
        const detectedFiles: string[] = [];

        // Check for Node.js
        if (files.includes('package.json')) {
            detectedFiles.push('package.json');
            let startScript = 'dev';

            try {
                const pkgJson = await instance.fs.readFile('package.json', 'utf-8');
                const pkg = JSON.parse(pkgJson);

                if (pkg.scripts) {
                    if (pkg.scripts.dev) {
                        startScript = 'dev';
                    } else if (pkg.scripts.start) {
                        startScript = 'start';
                    } else if (pkg.scripts.preview) {
                        startScript = 'preview';
                    } else {
                        const firstScript = Object.keys(pkg.scripts)[0];
                        if (firstScript) {
                            startScript = firstScript;
                        }
                    }
                }
            } catch (e) {
                console.error('Error reading or parsing package.json:', e);
            }

            // Detect package manager from lockfiles
            const packageManager = detectPackageManager(files);
            detectedFiles.push(...getPackageManagerFiles(files));

            // Build install command based on package manager
            const installCommand = getInstallCommand(packageManager);

            // Pre-install commands kept minimal for speed
            const preInstallCommands: [string, string[]][] = [];
            // NOTE: browserslist update is handled via BROWSERSLIST_IGNORE_OLD_DATA env var
            // instead of the slow `npx update-browserslist-db@latest` command

            return {
                type: 'node',
                installCommand,
                preInstallCommands,
                startCommand: ['npm', ['run', startScript]],
                detectedFiles,
                reason: `Node.js project detected (${packageManager || 'npm'})`,
                packageManager: packageManager || 'npm',
                shouldRemoveLockfile: true,
            };
        }

        // Check for Python
        if (files.includes('requirements.txt')) {
            detectedFiles.push('requirements.txt');
            return {
                type: 'python',
                installCommand: null,
                preInstallCommands: [],
                startCommand: null,
                detectedFiles,
                reason: 'Python project detected via requirements.txt',
                packageManager: null,
                shouldRemoveLockfile: false,
            };
        }

        // Check for Docker
        const dockerFiles = files.filter(f => f.toLowerCase().includes('dockerfile'));
        if (dockerFiles.length > 0) {
            detectedFiles.push(dockerFiles[0]);
            return {
                type: 'docker',
                installCommand: null,
                preInstallCommands: [],
                startCommand: null,
                detectedFiles,
                reason: 'Docker project detected via Dockerfile',
                packageManager: null,
                shouldRemoveLockfile: false,
            };
        }

        // Check for Static HTML
        if (files.includes('index.html')) {
            detectedFiles.push('index.html');
            return {
                type: 'static',
                installCommand: null,
                preInstallCommands: [],
                startCommand: ['npx', ['--yes', 'serve']],
                detectedFiles,
                reason: 'Static HTML project detected via index.html',
                packageManager: null,
                shouldRemoveLockfile: false,
            };
        }

        return {
            type: 'unknown',
            installCommand: null,
            preInstallCommands: [],
            startCommand: null,
            detectedFiles: [],
            reason: 'Could not automatically detect project type',
            packageManager: null,
            shouldRemoveLockfile: false,
        };
    } catch (error) {
        console.error('Error during project analysis:', error);
        return {
            type: 'unknown',
            installCommand: null,
            preInstallCommands: [],
            startCommand: null,
            detectedFiles: [],
            reason: 'Error occurred while analyzing project files',
            packageManager: null,
            shouldRemoveLockfile: false,
        };
    }
}

function detectPackageManager(files: string[]): "npm" | "yarn" | "pnpm" | "bun" | null {
    if (files.includes('bun.lockb') || files.includes('bun.lock')) return 'bun';
    if (files.includes('pnpm-lock.yaml')) return 'pnpm';
    if (files.includes('yarn.lock')) return 'yarn';
    if (files.includes('package-lock.json')) return 'npm';
    return null; // default to npm
}

function getPackageManagerFiles(files: string[]): string[] {
    const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock'];
    return files.filter(f => lockFiles.includes(f));
}

function getInstallCommand(packageManager: string | null): [string, string[]] {
    switch (packageManager) {
        case 'yarn':
            return ['yarn', ['install', '--non-interactive']];
        case 'pnpm':
            return ['pnpm', ['install', '--no-frozen-lockfile']];
        case 'bun':
            return ['bun', ['install']];
        case 'npm':
        default:
            // Speed-optimized flags:
            // --yes: auto-accept prompts
            // --no-audit: skip vulnerability audit (faster)
            // --no-fund: skip funding messages (cleaner output)
            // --loglevel=warn: show warnings but not info noise
            // --legacy-peer-deps: skip peer dep conflicts (ERESOLVE errors)
            // --prefer-offline: use cached packages when available (big speedup)
            // --ignore-scripts: skip post-install scripts (often fail in WebContainer)
            // --progress=true: show download progress so users know it's working
            return ['npm', ['install', '--yes', '--no-audit', '--no-fund', '--loglevel=warn', '--legacy-peer-deps', '--prefer-offline', '--ignore-scripts', '--progress=true']];
    }
}
