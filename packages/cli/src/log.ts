/* eslint-disable no-console */

import chalk from 'chalk';

export const logLevels = ['verbose', 'info', 'warn', 'error'] as const;

export type LogLevel = typeof logLevels[number];

let logLevel: LogLevel = 'info';

export const getLogLevel = () => {
	return logLevel;
};

export const setLogLevel = (newLogLevel: LogLevel) => {
	logLevel = newLogLevel;
};

const getNumberForLogLevel = (level: LogLevel) => {
	return logLevels.indexOf(level);
};

export const isValidLogLevel = (level: string) => {
	return getNumberForLogLevel(level as LogLevel) >= -1;
};

export const isEqualOrBelowLogLevel = (level: LogLevel) => {
	return getNumberForLogLevel(logLevel) <= getNumberForLogLevel(level);
};

export const Log = {
	Verbose: (...args: Parameters<typeof console.log>) => {
		if (isEqualOrBelowLogLevel('verbose')) {
			return console.log(chalk.blueBright(...args));
		}
	},
	Info: (...args: Parameters<typeof console.log>) => {
		if (isEqualOrBelowLogLevel('info')) {
			return console.log(...args);
		}
	},
	Warn: (...args: Parameters<typeof console.log>) => {
		if (isEqualOrBelowLogLevel('warn')) {
			return console.log(chalk.yellow(...args));
		}
	},
	Error: (...args: Parameters<typeof console.log>) => {
		if (isEqualOrBelowLogLevel('error')) {
			return console.log(chalk.red(...args));
		}
	},
};
