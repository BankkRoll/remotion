import type {EmittedArtifact, StillImageFormat} from '@remotion/renderer';
import {RenderInternals} from '@remotion/renderer';
import type {
	CloudProvider,
	OnStream,
	ReceivedArtifact,
	RenderStillLambdaResponsePayload,
} from '@remotion/serverless';
import {
	forgetBrowserEventLoop,
	getBrowserInstance,
	getCredentialsFromOutName,
	getTmpDirStateIfENoSp,
	validateComposition,
	validateOutname,
	type ProviderSpecifics,
} from '@remotion/serverless';
import type {
	RenderMetadata,
	ServerlessPayload,
} from '@remotion/serverless/client';
import {
	ServerlessRoutines,
	artifactName,
	decompressInputProps,
	getExpectedOutName,
	internalGetOrCreateBucket,
	overallProgressKey,
} from '@remotion/serverless/client';
import fs from 'node:fs';
import path from 'node:path';
import {NoReactInternals} from 'remotion/no-react';
import {VERSION} from 'remotion/version';
import {estimatePrice} from '../api/estimate-price';
import {MAX_EPHEMERAL_STORAGE_IN_MB} from '../defaults';
import type {AwsRegion} from '../regions';
import {cleanupSerializedInputProps} from '../shared/cleanup-serialized-input-props';
import {isFlakyError} from '../shared/is-flaky-error';
import {validateDownloadBehavior} from '../shared/validate-download-behavior';
import {validatePrivacy} from '../shared/validate-privacy';
import {formatCostsInfo} from './helpers/format-costs-info';
import {getOutputUrlFromMetadata} from './helpers/get-output-url-from-metadata';
import {onDownloadsHelper} from './helpers/on-downloads-logger';
import {makeInitialOverallRenderProgress} from './helpers/overall-render-progress';

type Options<Provider extends CloudProvider> = {
	params: ServerlessPayload<Provider>;
	renderId: string;
	expectedBucketOwner: string;
	onStream: OnStream<Provider>;
	timeoutInMilliseconds: number;
	providerSpecifics: ProviderSpecifics<Provider>;
};

const innerStillHandler = async <Provider extends CloudProvider>(
	{
		params: lambdaParams,
		expectedBucketOwner,
		renderId,
		onStream,
		timeoutInMilliseconds,
		providerSpecifics,
	}: Options<Provider>,
	cleanup: CleanupFn[],
) => {
	if (lambdaParams.type !== ServerlessRoutines.still) {
		throw new TypeError('Expected still type');
	}

	if (lambdaParams.version !== VERSION) {
		if (!lambdaParams.version) {
			throw new Error(
				`Version mismatch: When calling renderStillOnLambda(), you called the function ${process.env.AWS_LAMBDA_FUNCTION_NAME} which has the version ${VERSION} but the @remotion/lambda package is an older version. Deploy a new function and use it to call renderStillOnLambda(). See: https://www.remotion.dev/docs/lambda/upgrading`,
			);
		}

		throw new Error(
			`Version mismatch: When calling renderStillOnLambda(), you passed ${process.env.AWS_LAMBDA_FUNCTION_NAME} as the function, which has the version ${VERSION}, but the @remotion/lambda package you used to invoke the function has version ${lambdaParams.version}. Deploy a new function and use it to call renderStillOnLambda(). See: https://www.remotion.dev/docs/lambda/upgrading`,
		);
	}

	validateDownloadBehavior(lambdaParams.downloadBehavior);
	validatePrivacy(lambdaParams.privacy, true);
	validateOutname({
		outName: lambdaParams.outName,
		codec: null,
		audioCodecSetting: null,
		separateAudioTo: null,
	});

	const start = Date.now();

	const browserInstancePromise = getBrowserInstance({
		logLevel: lambdaParams.logLevel,
		indent: false,
		chromiumOptions: lambdaParams.chromiumOptions,
		providerSpecifics,
	});
	const bucketNamePromise =
		lambdaParams.bucketName ??
		internalGetOrCreateBucket({
			region: providerSpecifics.getCurrentRegionInFunction(),
			enableFolderExpiry: null,
			customCredentials: null,
			providerSpecifics,
			forcePathStyle: lambdaParams.forcePathStyle,
		}).then((b) => b.bucketName);

	const outputDir = RenderInternals.tmpDir('remotion-render-');

	const outputPath = path.join(outputDir, 'output');

	const region = providerSpecifics.getCurrentRegionInFunction();
	const bucketName = await bucketNamePromise;
	const serializedInputPropsWithCustomSchema = await decompressInputProps({
		bucketName,
		expectedBucketOwner,
		region,
		serialized: lambdaParams.inputProps,
		propsType: 'input-props',
		providerSpecifics,
		forcePathStyle: lambdaParams.forcePathStyle,
	});

	const serveUrl = providerSpecifics.convertToServeUrl({
		urlOrId: lambdaParams.serveUrl,
		region,
		bucketName,
	});

	const {server, cleanupServer} = await RenderInternals.makeOrReuseServer(
		undefined,
		{
			concurrency: 1,
			indent: false,
			port: null,
			remotionRoot: process.cwd(),
			logLevel: lambdaParams.logLevel,
			webpackConfigOrServeUrl: serveUrl,
			offthreadVideoCacheSizeInBytes:
				lambdaParams.offthreadVideoCacheSizeInBytes,
			binariesDirectory: null,
			forceIPv4: false,
		},
		{
			onDownload: () => undefined,
		},
	);

	cleanup.push(() => cleanupServer(true));

	const browserInstance = await browserInstancePromise;
	const composition = await validateComposition({
		serveUrl,
		browserInstance: browserInstance.instance,
		composition: lambdaParams.composition,
		serializedInputPropsWithCustomSchema,
		envVariables: lambdaParams.envVariables ?? {},
		chromiumOptions: lambdaParams.chromiumOptions,
		timeoutInMilliseconds: lambdaParams.timeoutInMilliseconds,
		port: null,
		forceHeight: lambdaParams.forceHeight,
		forceWidth: lambdaParams.forceWidth,
		logLevel: lambdaParams.logLevel,
		server,
		offthreadVideoCacheSizeInBytes: lambdaParams.offthreadVideoCacheSizeInBytes,
		onBrowserDownload: () => {
			throw new Error('Should not download a browser in Lambda');
		},
		onServeUrlVisited: () => undefined,
		providerSpecifics,
	});

	const renderMetadata: RenderMetadata<Provider> = {
		startedDate: Date.now(),
		codec: null,
		compositionId: lambdaParams.composition,
		estimatedTotalLambdaInvokations: 1,
		estimatedRenderLambdaInvokations: 1,
		siteId: serveUrl,
		totalChunks: 1,
		type: 'still',
		imageFormat: lambdaParams.imageFormat,
		inputProps: lambdaParams.inputProps,
		lambdaVersion: VERSION,
		framesPerLambda: 1,
		memorySizeInMb: Number(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE),
		region: providerSpecifics.getCurrentRegionInFunction(),
		renderId,
		outName: lambdaParams.outName ?? undefined,
		privacy: lambdaParams.privacy,
		audioCodec: null,
		deleteAfter: lambdaParams.deleteAfter,
		numberOfGifLoops: null,
		downloadBehavior: lambdaParams.downloadBehavior,
		audioBitrate: null,
		metadata: null,
		functionName: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
		dimensions: {
			height: composition.height * (lambdaParams.scale ?? 1),
			width: composition.width * (lambdaParams.scale ?? 1),
		},
	};

	const still = makeInitialOverallRenderProgress(timeoutInMilliseconds);
	still.renderMetadata = renderMetadata;

	await providerSpecifics.writeFile({
		bucketName,
		key: overallProgressKey(renderId),
		body: JSON.stringify(still),
		region: providerSpecifics.getCurrentRegionInFunction(),
		privacy: 'private',
		expectedBucketOwner,
		downloadBehavior: null,
		customCredentials: null,
		forcePathStyle: lambdaParams.forcePathStyle,
	});

	const onBrowserDownload = () => {
		throw new Error('Should not download a browser in Lambda');
	};

	const receivedArtifact: ReceivedArtifact<Provider>[] = [];

	const {key, renderBucketName, customCredentials} = getExpectedOutName(
		renderMetadata,
		bucketName,
		getCredentialsFromOutName(lambdaParams.outName),
	);

	const onArtifact = (artifact: EmittedArtifact): {alreadyExisted: boolean} => {
		if (receivedArtifact.find((a) => a.filename === artifact.filename)) {
			return {alreadyExisted: true};
		}

		const storageKey = artifactName(renderMetadata.renderId, artifact.filename);

		receivedArtifact.push(
			providerSpecifics.makeArtifactWithDetails({
				storageKey,
				artifact,
				region,
				renderBucketName,
			}),
		);

		const startTime = Date.now();
		RenderInternals.Log.info(
			{indent: false, logLevel: lambdaParams.logLevel},
			'Writing artifact ' + artifact.filename + ' to S3',
		);
		providerSpecifics
			.writeFile({
				bucketName: renderBucketName,
				key: storageKey,
				body: artifact.content,
				region,
				privacy: lambdaParams.privacy,
				expectedBucketOwner,
				downloadBehavior: lambdaParams.downloadBehavior,
				customCredentials,
				forcePathStyle: lambdaParams.forcePathStyle,
			})
			.then(() => {
				RenderInternals.Log.info(
					{indent: false, logLevel: lambdaParams.logLevel},
					`Wrote artifact to S3 in ${Date.now() - startTime}ms`,
				);
			})
			.catch((err) => {
				RenderInternals.Log.error(
					{indent: false, logLevel: lambdaParams.logLevel},
					'Failed to write artifact to S3',
					err,
				);
			});
		return {alreadyExisted: false};
	};

	await RenderInternals.internalRenderStill({
		composition,
		output: outputPath,
		serveUrl,
		envVariables: lambdaParams.envVariables ?? {},
		frame: RenderInternals.convertToPositiveFrameIndex({
			frame: lambdaParams.frame,
			durationInFrames: composition.durationInFrames,
		}),
		imageFormat: lambdaParams.imageFormat as StillImageFormat,
		serializedInputPropsWithCustomSchema,
		overwrite: false,
		puppeteerInstance: browserInstance.instance,
		jpegQuality:
			lambdaParams.jpegQuality ?? RenderInternals.DEFAULT_JPEG_QUALITY,
		chromiumOptions: lambdaParams.chromiumOptions,
		scale: lambdaParams.scale,
		timeoutInMilliseconds: lambdaParams.timeoutInMilliseconds,
		browserExecutable: providerSpecifics.getChromiumPath(),
		cancelSignal: null,
		indent: false,
		onBrowserLog: null,
		onDownload: onDownloadsHelper(lambdaParams.logLevel),
		port: null,
		server,
		logLevel: lambdaParams.logLevel,
		serializedResolvedPropsWithCustomSchema:
			NoReactInternals.serializeJSONWithDate({
				indent: undefined,
				staticBase: null,
				data: composition.props,
			}).serializedString,
		offthreadVideoCacheSizeInBytes: lambdaParams.offthreadVideoCacheSizeInBytes,
		binariesDirectory: null,
		onBrowserDownload,
		onArtifact,
	});

	const {size} = await fs.promises.stat(outputPath);

	await providerSpecifics.writeFile({
		bucketName: renderBucketName,
		key,
		privacy: lambdaParams.privacy,
		body: fs.createReadStream(outputPath),
		expectedBucketOwner,
		region: providerSpecifics.getCurrentRegionInFunction(),
		downloadBehavior: lambdaParams.downloadBehavior,
		customCredentials,
		forcePathStyle: lambdaParams.forcePathStyle,
	});

	await Promise.all([
		fs.promises.rm(outputPath, {recursive: true}),
		cleanupSerializedInputProps({
			region: providerSpecifics.getCurrentRegionInFunction(),
			serialized: lambdaParams.inputProps,
			providerSpecifics,
			forcePathStyle: lambdaParams.forcePathStyle,
		}),
		server.closeServer(true),
	]);

	const estimatedPrice = estimatePrice({
		durationInMilliseconds: Date.now() - start + 100,
		memorySizeInMb: Number(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE),
		region: providerSpecifics.getCurrentRegionInFunction() as AwsRegion,
		lambdasInvoked: 1,
		// We cannot determine the ephemeral storage size, so we
		// overestimate the price, but will only have a miniscule effect (~0.2%)
		diskSizeInMb: MAX_EPHEMERAL_STORAGE_IN_MB,
	});

	const {key: outKey, url} = getOutputUrlFromMetadata(
		renderMetadata,
		bucketName,
		customCredentials,
		providerSpecifics.getCurrentRegionInFunction(),
	);

	const payload: RenderStillLambdaResponsePayload<Provider> = {
		type: 'success' as const,
		output: url,
		size,
		sizeInBytes: size,
		bucketName,
		estimatedPrice: formatCostsInfo(estimatedPrice),
		renderId,
		outKey,
		receivedArtifacts: receivedArtifact,
	};

	onStream({
		type: 'still-rendered',
		payload,
	});

	await server.closeServer(true);
};

type CleanupFn = () => Promise<unknown>;

export const stillHandler = async <Provider extends CloudProvider>(
	options: Options<Provider>,
): Promise<
	| {
			type: 'success';
	  }
	| {
			type: 'error';
			message: string;
			stack: string;
	  }
> => {
	const {params} = options;

	const cleanUpFn: CleanupFn[] = [];

	if (params.type !== ServerlessRoutines.still) {
		throw new Error('Params must be renderer');
	}

	try {
		await innerStillHandler(options, cleanUpFn);
		return {type: 'success'};
	} catch (err) {
		// If this error is encountered, we can just retry as it
		// is a very rare error to occur
		const isBrowserError = isFlakyError(err as Error);
		const willRetry = isBrowserError || params.maxRetries > 0;

		RenderInternals.Log.error(
			{
				indent: false,
				logLevel: params.logLevel,
			},
			'Got error:',
			(err as Error).stack,
			`Will retry = ${willRetry}`,
		);

		if (params.streamed) {
			await options.onStream({
				type: 'error-occurred',
				payload: {
					error: (err as Error).stack as string,
					shouldRetry: willRetry,
					errorInfo: {
						name: (err as Error).name as string,
						message: (err as Error).message as string,
						stack: (err as Error).stack as string,
						chunk: null,
						frame: params.frame,
						type: 'renderer',
						isFatal: false,
						tmpDir: getTmpDirStateIfENoSp(
							(err as Error).stack as string,
							options.providerSpecifics,
						),
						attempt: params.attempt,
						totalAttempts: 1 + params.maxRetries,
						willRetry,
					},
				},
			});
		}

		return {
			type: 'error',
			message: (err as Error).message,
			stack: (err as Error).stack as string,
		};
	} finally {
		forgetBrowserEventLoop(
			options.params.type === ServerlessRoutines.still
				? options.params.logLevel
				: 'error',
		);

		cleanUpFn.forEach((c) => c());
	}
};
