import type {CloudProvider, EnhancedErrorInfo} from '@remotion/serverless';
import type {RenderMetadata} from '@remotion/serverless/client';
import {makeTimeoutMessage} from './make-timeout-message';

export const makeTimeoutError = <Provider extends CloudProvider>({
	timeoutInMilliseconds,
	missingChunks,
	renderMetadata,
	renderId,
	functionName,
	region,
}: {
	timeoutInMilliseconds: number;
	renderMetadata: RenderMetadata<Provider>;
	renderId: string;
	missingChunks: number[];
	functionName: string;
	region: Provider['region'];
}): EnhancedErrorInfo => {
	const message = makeTimeoutMessage({
		missingChunks,
		renderMetadata,
		timeoutInMilliseconds,
		renderId,
		functionName,
		region,
	});

	const error = new Error(message);

	return {
		attempt: 1,
		chunk: null,
		explanation: null,
		frame: null,
		isFatal: true,
		s3Location: '',
		stack: error.stack as string,
		tmpDir: null,
		totalAttempts: 1,
		type: 'stitcher',
		willRetry: false,
		message,
		name: 'TimeoutError',
	};
};
