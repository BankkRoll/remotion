// When Webpack cannot resolve these dependencies, it will not print an error message.

import type {Compiler} from '@rspack/core';

const OPTIONAL_DEPENDENCIES = [
	'zod',
	'@remotion/zod-types',
	'react-native-reanimated',
	'react-native-reanimated/package.json',
];

const SOURCE_MAP_IGNORE = ['path', 'fs'];

export class AllowOptionalDependenciesPlugin {
	filter(error: Error) {
		for (const dependency of OPTIONAL_DEPENDENCIES) {
			if (error.message.includes(`Can't resolve '${dependency}'`)) {
				return false;
			}
		}

		for (const dependency of SOURCE_MAP_IGNORE) {
			if (
				error.message.includes(`Can't resolve '${dependency}'`) &&
				error.message.includes('source-map')
			) {
				return false;
			}
		}

		return true;
	}

	apply(compiler: Compiler) {
		compiler.hooks.afterCompile.tap('Com', () => {
			// TODO: Filter
		});
		compiler.hooks.afterEmit.tap('AllowOptionalDependenciesPlugin', () => {
			// TODO: Filter
		});
	}
}
