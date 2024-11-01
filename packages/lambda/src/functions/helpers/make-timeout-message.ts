import type {CloudProvider} from '@remotion/serverless';
import type {RenderMetadata} from '@remotion/serverless/client';
import {ServerlessRoutines} from '@remotion/serverless/client';
import type {AwsRegion} from '../../regions';
import {DOCS_URL} from '../../shared/docs-url';
import {
	getCloudwatchMethodUrl,
	getCloudwatchRendererUrl,
} from '../../shared/get-aws-urls';

const MAX_MISSING_CHUNKS = 5;

const makeChunkMissingMessage = <Provider extends CloudProvider>({
	missingChunks,
	renderMetadata,
	region,
}: {
	missingChunks: number[];
	renderMetadata: RenderMetadata<Provider>;
	region: Provider['region'];
}) => {
	if (missingChunks.length === 0) {
		return 'All chunks have been successfully rendered, but the main function has timed out.';
	}

	return [
		`The following chunks are missing (showing ${Math.min(
			MAX_MISSING_CHUNKS,
			missingChunks.length,
		)} out of ${missingChunks.length}):`,
		...missingChunks
			.map((ch) => {
				const isLastChunk = ch === renderMetadata.totalChunks - 1;
				const start = ch * renderMetadata.framesPerLambda;
				const end =
					renderMetadata.type === 'still'
						? 0
						: isLastChunk
							? renderMetadata.frameRange[1]
							: (ch + 1) * renderMetadata.framesPerLambda - 1;

				const msg = `Chunk ${ch} (Frames ${start} - ${end})`;

				return [
					msg,
					`▸ Logs for chunk ${ch}: ${getCloudwatchRendererUrl({
						functionName: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
						region: region as AwsRegion,
						rendererFunctionName: null,
						renderId: renderMetadata.renderId,
						chunk: ch,
					})}`,
				].join('\n');
			})
			.slice(0, 5),
	].join('\n');
};

export const makeTimeoutMessage = <Provider extends CloudProvider>({
	timeoutInMilliseconds,
	missingChunks,
	renderMetadata,
	renderId,
	functionName,
	region,
}: {
	timeoutInMilliseconds: number;
	missingChunks: number[];
	renderMetadata: RenderMetadata<Provider>;
	renderId: string;
	region: Provider['region'];
	functionName: string;
}) => {
	const cloudWatchRendererUrl = getCloudwatchRendererUrl({
		renderId,
		functionName,
		region: region as AwsRegion,
		rendererFunctionName: functionName,
		chunk: null,
	});

	const cloudWatchLaunchUrl = getCloudwatchMethodUrl({
		renderId,
		functionName,
		method: ServerlessRoutines.launch,
		region: region as AwsRegion,
		rendererFunctionName: functionName,
	});
	const message = [
		`The main function timed out after ${timeoutInMilliseconds}ms.`,
		makeChunkMissingMessage({
			missingChunks,
			renderMetadata,
			region,
		}),
		'',
		`Consider increasing the timeout of your function.`,
		`▸ You can use the "--timeout" parameter when deploying a function via CLI, or the "timeoutInSeconds" parameter when using the deployFunction() API.`,
		`${DOCS_URL}/docs/lambda/cli/functions#deploy`,
		'',
		'▸ Visit the logs for the main function:',
		cloudWatchLaunchUrl,
		'▸ Visit the logs for the renderer functions:',
		cloudWatchRendererUrl,
		'',
		'▸ Get help on debugging this error:',
		`${DOCS_URL}/docs/lambda/troubleshooting/debug`,
	].join('\n');

	return message;
};
