import {RenderInternals} from '@remotion/renderer';
import {
	listOfInstallableRemotionPackages,
	type InstallPackageRequest,
	type InstallPackageResponse,
	type PackageManager,
} from '@remotion/studio-shared';
import {spawn} from 'node:child_process';
import {VERSION} from 'remotion/version';
import type {ApiHandler} from '../api-types';
import {getPackageManager, lockFilePaths} from '../get-package-manager';

export const getInstallCommand = ({
	manager,
	packages,
	version,
}: {
	manager: PackageManager;
	packages: string[];
	version: string;
}): string[] => {
	const pkgList = packages.map((p) => `${p}@${version}`);
	const commands: {[key in PackageManager]: string[]} = {
		npm: ['i', '--save-exact', '--no-fund', '--no-audit', ...pkgList],
		pnpm: ['i', ...pkgList],
		yarn: ['add', '--exact', ...pkgList],
		bun: ['i', ...pkgList],
	};

	return commands[manager];
};

export const handleInstallPackage: ApiHandler<
	InstallPackageRequest,
	InstallPackageResponse
> = async ({logLevel, remotionRoot, input: {packageNames}}) => {
	for (const packageName of packageNames) {
		if (listOfInstallableRemotionPackages.includes(packageName) === false) {
			return Promise.reject(
				new Error(`Package ${packageName} is not allowed to be installed.`),
			);
		}
	}

	const manager = getPackageManager(remotionRoot, undefined, 0);
	if (manager === 'unknown') {
		throw new Error(
			`No lockfile was found in your project (one of ${lockFilePaths
				.map((p) => p.path)
				.join(', ')}). Install dependencies using your favorite manager!`,
		);
	}

	const command = getInstallCommand({
		manager: manager.manager,
		packages: packageNames,
		version: VERSION,
	});

	RenderInternals.Log.info(
		{indent: false, logLevel},
		RenderInternals.chalk.gray(`╭─  ${manager.manager} ${command.join(' ')}`),
	);

	const time = Date.now();
	try {
		await new Promise<void>((resolve, reject) => {
			const cmd = spawn(manager.manager, command, {});
			cmd.stdout.on('data', (d: Buffer) => {
				const splitted = d.toString().trim().split('\n');
				splitted.forEach((line) => {
					RenderInternals.Log.info({indent: true, logLevel}, line);
				});
			});
			cmd.stdout.on('end', () => {
				resolve();
			});
			cmd.on('close', (code, signal) => {
				if (code === 0) {
					resolve();
				} else {
					reject(
						new Error(`Command exited with code ${code} and signal ${signal}`),
					);
				}
			});
		});
		const timeEnd = Date.now();

		RenderInternals.Log.info(
			{indent: false, logLevel},
			RenderInternals.chalk.gray('╰─ '),
			`Done in ${timeEnd - time}ms`,
		);
		return Promise.resolve({});
	} catch (err) {
		const timeEnd = Date.now();
		RenderInternals.Log.info(
			{indent: false, logLevel},
			RenderInternals.chalk.gray('╰─ '),
			RenderInternals.chalk.red(`Errored in ${timeEnd - time}ms`),
		);
		return Promise.reject(err);
	}
};
