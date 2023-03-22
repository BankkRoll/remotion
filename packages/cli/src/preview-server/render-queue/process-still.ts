import {convertEntryPointToServeUrl} from '../../convert-entry-point-to-serve-url';
import {getCliOptions} from '../../get-cli-options';
import {renderStillFlow} from '../../render-flows/still';
import type {GuiStillProgress, JobProgressCallback, RenderJob} from './job';

export const processStill = async ({
	job,
	remotionRoot,
	entryPoint,
	onProgress,
	addCleanupCallback,
}: {
	job: RenderJob;
	remotionRoot: string;
	entryPoint: string;
	onProgress: JobProgressCallback<GuiStillProgress>;
	addCleanupCallback: (cb: () => void) => void;
}) => {
	if (job.type !== 'still') {
		throw new Error('Expected still job');
	}

	const {
		publicDir,
		browserExecutable,
		// TODO: Accept chromium options from UI
		chromiumOptions,
		// TODO: Accept env variables from UI
		envVariables,
		// TODO: Accept input props from UI
		inputProps,
		port,
		browser,
		puppeteerTimeout,
	} = await getCliOptions({
		isLambda: false,
		type: 'still',
		remotionRoot,
	});

	const fullEntryPoint = convertEntryPointToServeUrl(entryPoint);

	await renderStillFlow({
		remotionRoot,
		browser,
		browserExecutable,
		chromiumOptions,
		entryPointReason: 'same as preview',
		envVariables,
		height: null,
		fullEntryPoint,
		inputProps,
		overwrite: true,
		port,
		publicDir,
		puppeteerTimeout,
		quality: job.quality ?? undefined,
		remainingArgs: [],
		scale: job.scale,
		stillFrame: job.frame,
		width: null,
		compositionIdFromUi: job.compositionId,
		imageFormatFromUi: job.imageFormat,
		logLevel: job.verbose ? 'verbose' : 'info',
		onProgress,
		indentOutput: true,
		addCleanupCallback,
		cancelSignal: job.cancelToken.cancelSignal,
	});
};
