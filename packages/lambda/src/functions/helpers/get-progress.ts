import {NoReactAPIs} from '@remotion/renderer/pure';
import type {
	CloudProvider,
	EnhancedErrorInfo,
	ProviderSpecifics,
} from '@remotion/serverless';
import {
	getExpectedOutName,
	truthy,
	type CustomCredentials,
} from '@remotion/serverless/client';
import {NoReactInternals} from 'remotion/no-react';
import type {AwsRegion} from '../../regions';
import type {CleanupInfo, GenericRenderProgress} from '../../shared/constants';
import {MAX_EPHEMERAL_STORAGE_IN_MB} from '../../shared/constants';
import {calculateChunkTimes} from './calculate-chunk-times';
import {estimatePriceFromBucket} from './calculate-price-from-bucket';
import {formatCostsInfo} from './format-costs-info';
import {getOverallProgress} from './get-overall-progress';
import {getOverallProgressS3} from './get-overall-progress-s3';
import {inspectErrors} from './inspect-errors';
import {makeTimeoutError} from './make-timeout-error';
import {lambdaRenderHasAudioVideo} from './render-has-audio-video';

export const getProgress = async <Provider extends CloudProvider>({
	bucketName,
	renderId,
	expectedBucketOwner,
	region,
	memorySizeInMb,
	timeoutInMilliseconds,
	customCredentials,
	providerSpecifics,
	forcePathStyle,
	functionName,
}: {
	bucketName: string;
	renderId: string;
	expectedBucketOwner: string | null;
	region: Provider['region'];
	memorySizeInMb: number;
	timeoutInMilliseconds: number;
	customCredentials: CustomCredentials<Provider> | null;
	providerSpecifics: ProviderSpecifics<Provider>;
	forcePathStyle: boolean;
	functionName: string;
}): Promise<GenericRenderProgress<Provider>> => {
	const overallProgress = await getOverallProgressS3({
		renderId,
		bucketName,
		expectedBucketOwner,
		region,
		providerSpecifics,
		forcePathStyle,
	});

	if (overallProgress.postRenderData) {
		if (!overallProgress.renderMetadata) {
			throw new Error(
				'No render metadata found even though render is finished',
			);
		}

		if (overallProgress.renderMetadata.type === 'still') {
			throw new Error(
				"You don't need to call getRenderProgress() on a still render. Once you have obtained the `renderId`, the render is already done! 😉",
			);
		}

		const outData = getExpectedOutName(
			overallProgress.renderMetadata,
			bucketName,
			customCredentials,
		);

		const totalFrameCount = NoReactAPIs.getFramesToRender(
			overallProgress.renderMetadata.frameRange,
			overallProgress.renderMetadata.everyNthFrame,
		).length;

		return {
			framesRendered: totalFrameCount,
			bucket: bucketName,
			renderSize: overallProgress.postRenderData.renderSize,
			chunks: overallProgress.renderMetadata.totalChunks,
			cleanup: {
				doneIn: overallProgress.postRenderData.timeToCleanUp,
				filesDeleted: overallProgress.postRenderData.filesCleanedUp,
				minFilesToDelete: overallProgress.postRenderData.filesCleanedUp,
			},
			costs: {
				accruedSoFar: overallProgress.postRenderData.cost.estimatedCost,
				displayCost: overallProgress.postRenderData.cost.estimatedDisplayCost,
				currency: overallProgress.postRenderData.cost.currency,
				disclaimer: overallProgress.postRenderData.cost.disclaimer,
			},
			currentTime: Date.now(),
			done: true,
			encodingStatus: {
				framesEncoded: totalFrameCount,
				combinedFrames: totalFrameCount,
				timeToCombine: overallProgress.postRenderData.timeToCombine,
			},
			errors: overallProgress.postRenderData.errors,
			fatalErrorEncountered: false,
			lambdasInvoked: overallProgress.renderMetadata.totalChunks,
			outputFile: overallProgress.postRenderData.outputFile,
			renderId,
			timeToFinish: overallProgress.postRenderData.timeToFinish,
			timeToFinishChunks: overallProgress.postRenderData.timeToRenderChunks,
			timeToRenderFrames: overallProgress.postRenderData.timeToRenderFrames,
			overallProgress: 1,
			retriesInfo: overallProgress.postRenderData.retriesInfo,
			outKey: outData.key,
			outBucket: outData.renderBucketName,
			mostExpensiveFrameRanges:
				overallProgress.postRenderData.mostExpensiveFrameRanges ?? null,
			timeToEncode: overallProgress.postRenderData.timeToEncode,
			outputSizeInBytes: overallProgress.postRenderData.outputSize,
			type: 'success',
			estimatedBillingDurationInMilliseconds:
				overallProgress.postRenderData.estimatedBillingDurationInMilliseconds,
			timeToCombine: overallProgress.postRenderData.timeToCombine,
			combinedFrames: totalFrameCount,
			renderMetadata: overallProgress.renderMetadata,
			timeoutTimestamp: overallProgress.timeoutTimestamp,
			compositionValidated: overallProgress.compositionValidated,
			functionLaunched: overallProgress.functionLaunched,
			serveUrlOpened: overallProgress.serveUrlOpened,
			artifacts: overallProgress.receivedArtifact,
		};
	}

	const {renderMetadata} = overallProgress;

	const errorExplanations = inspectErrors({
		errors: overallProgress.errors,
	});

	const {hasAudio, hasVideo} = renderMetadata
		? lambdaRenderHasAudioVideo(renderMetadata)
		: {hasAudio: false, hasVideo: false};

	const chunkCount = overallProgress.chunks.length ?? 0;

	const cleanup: CleanupInfo = {
		doneIn: null,
		minFilesToDelete: 0,
		filesDeleted: 0,
	};

	if (renderMetadata === null) {
		return {
			framesRendered: overallProgress.framesRendered ?? 0,
			chunks: chunkCount,
			done: false,
			encodingStatus: {
				framesEncoded: overallProgress.framesEncoded,
				combinedFrames: overallProgress.combinedFrames,
				timeToCombine: overallProgress.timeToCombine,
			},
			timeToRenderFrames: overallProgress.timeToRenderFrames,
			costs: formatCostsInfo(0),
			renderId,
			renderMetadata,
			bucket: bucketName,
			outputFile: null,
			timeToFinish: null,
			errors: errorExplanations,
			fatalErrorEncountered: errorExplanations.some(
				(f) => f.isFatal && !f.willRetry,
			),
			currentTime: Date.now(),
			renderSize: 0,
			lambdasInvoked: overallProgress.lambdasInvoked ?? 0,
			cleanup,
			timeToFinishChunks: null,
			overallProgress: getOverallProgress({
				encoding: 0,
				invoking: 0,
				frames: 0,
				gotComposition: overallProgress.compositionValidated,
				visitedServeUrl: overallProgress.serveUrlOpened,
				invokedLambda: overallProgress.lambdasInvoked,
				combining: 0,
			}),
			retriesInfo: overallProgress.retries ?? [],
			outKey: null,
			outBucket: null,
			mostExpensiveFrameRanges: null,
			timeToEncode: overallProgress.timeToEncode,
			outputSizeInBytes: null,
			estimatedBillingDurationInMilliseconds: null,
			combinedFrames: overallProgress.combinedFrames ?? 0,
			timeToCombine: overallProgress.timeToCombine ?? null,
			timeoutTimestamp: overallProgress.timeoutTimestamp,
			type: 'success',
			compositionValidated: overallProgress.compositionValidated,
			functionLaunched: overallProgress.functionLaunched,
			serveUrlOpened: overallProgress.serveUrlOpened,
			artifacts: overallProgress.receivedArtifact,
		};
	}

	const priceFromBucket = estimatePriceFromBucket({
		renderMetadata,
		memorySizeInMb,
		lambdasInvoked: renderMetadata.estimatedRenderLambdaInvokations ?? 0,
		// We cannot determine the ephemeral storage size, so we
		// overestimate the price, but will only have a miniscule effect (~0.2%)
		diskSizeInMb: MAX_EPHEMERAL_STORAGE_IN_MB,
		timings: overallProgress.timings ?? [],
		region: region as AwsRegion,
	});

	const chunkMultiplier = [hasAudio, hasVideo].filter(truthy).length;

	if (renderMetadata.type === 'still') {
		throw new Error(
			"You don't need to call getRenderProgress() on a still render. Once you have obtained the `renderId`, the render is already done! 😉",
		);
	}

	const allChunks =
		(overallProgress.chunks ?? []).length / chunkMultiplier ===
		(renderMetadata.totalChunks ?? Infinity);

	const frameCount = NoReactAPIs.getFramesToRender(
		renderMetadata.frameRange,
		renderMetadata.everyNthFrame,
	).length;

	const missingChunks = new Array(renderMetadata.totalChunks)
		.fill(true)
		.map((_, i) => i)
		.filter((index) => {
			return (
				typeof (overallProgress.chunks ?? []).find((c) => c === index) ===
				'undefined'
			);
		});
	// We add a 20 second buffer for it, since AWS timeshifts can be quite a lot. Once it's 20sec over the limit, we consider it timed out

	// 1. If we have missing chunks, we consider it timed out
	const isBeyondTimeoutAndMissingChunks =
		Date.now() > renderMetadata.startedDate + timeoutInMilliseconds + 20000 &&
		missingChunks &&
		missingChunks.length > 0;

	// 2. If we have no missing chunks, but the encoding is not done, even after the additional `merge` function has been spawned, we consider it timed out
	const isBeyondTimeoutAndHasStitchTimeout =
		Date.now() > renderMetadata.startedDate + timeoutInMilliseconds * 2 + 20000;

	const allErrors: EnhancedErrorInfo[] = [
		isBeyondTimeoutAndMissingChunks || isBeyondTimeoutAndHasStitchTimeout
			? makeTimeoutError({
					timeoutInMilliseconds,
					renderMetadata,
					renderId,
					missingChunks: missingChunks ?? [],
					region,
					functionName,
				})
			: null,
		...errorExplanations,
	].filter(NoReactInternals.truthy);

	return {
		framesRendered: overallProgress.framesRendered ?? 0,
		chunks: chunkCount,
		done: false,
		encodingStatus: {
			framesEncoded: overallProgress.framesEncoded,
			combinedFrames: overallProgress.combinedFrames,
			timeToCombine: overallProgress.timeToCombine,
		},
		timeToRenderFrames: overallProgress.timeToRenderFrames,
		costs: priceFromBucket
			? formatCostsInfo(priceFromBucket.accruedSoFar)
			: formatCostsInfo(0),
		renderId,
		renderMetadata,
		bucket: bucketName,
		outputFile: null,
		timeToFinish: null,
		errors: allErrors,
		fatalErrorEncountered: allErrors.some((f) => f.isFatal && !f.willRetry),
		currentTime: Date.now(),
		renderSize: 0,
		lambdasInvoked: overallProgress.lambdasInvoked ?? 0,
		cleanup,
		timeToFinishChunks:
			allChunks && overallProgress
				? calculateChunkTimes({
						type: 'absolute-time',
						timings: overallProgress.timings,
					})
				: null,
		overallProgress: getOverallProgress({
			encoding: frameCount
				? (overallProgress.framesEncoded ?? 0) / frameCount
				: 0,
			invoking:
				(overallProgress.lambdasInvoked ?? 0) /
				renderMetadata.estimatedRenderLambdaInvokations,
			frames: (overallProgress.framesRendered ?? 0) / (frameCount ?? 1),
			gotComposition: overallProgress.compositionValidated,
			visitedServeUrl: overallProgress.serveUrlOpened,
			invokedLambda: overallProgress.lambdasInvoked,
			combining: overallProgress.combinedFrames / (frameCount ?? 1),
		}),
		retriesInfo: overallProgress.retries ?? [],
		outKey: null,
		outBucket: null,
		mostExpensiveFrameRanges: null,
		timeToEncode: overallProgress.timeToEncode,
		outputSizeInBytes: null,
		estimatedBillingDurationInMilliseconds: priceFromBucket
			? priceFromBucket.estimatedBillingDurationInMilliseconds
			: null,
		combinedFrames: overallProgress.combinedFrames ?? 0,
		timeToCombine: overallProgress.timeToCombine ?? null,
		timeoutTimestamp: overallProgress.timeoutTimestamp,
		type: 'success',
		compositionValidated: overallProgress.compositionValidated,
		functionLaunched: overallProgress.functionLaunched,
		serveUrlOpened: overallProgress.serveUrlOpened,
		artifacts: overallProgress.receivedArtifact,
	};
};
