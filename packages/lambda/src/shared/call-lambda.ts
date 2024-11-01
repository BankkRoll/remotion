/* eslint-disable @typescript-eslint/no-use-before-define */
import type {
	InvokeWithResponseStreamCommandOutput,
	InvokeWithResponseStreamResponseEvent,
} from '@aws-sdk/client-lambda';
import {
	InvokeCommand,
	InvokeWithResponseStreamCommand,
} from '@aws-sdk/client-lambda';
import type {
	CloudProvider,
	OnMessage,
	StreamingMessage,
} from '@remotion/serverless';
import type {
	MessageTypeId,
	ServerlessPayloads,
	ServerlessRoutines,
} from '@remotion/serverless/client';
import {
	formatMap,
	messageTypeIdToMessageType,
} from '@remotion/serverless/client';
import {makeStreamer} from '@remotion/streaming';
import type {EventEmitter} from 'node:events';
import type {OrError} from '../functions';
import type {AwsRegion} from '../regions';
import {getLambdaClient} from './aws-clients';
import type {LambdaReturnValues} from './return-values';

const INVALID_JSON_MESSAGE = 'Cannot parse Lambda response as JSON';

type Options<T extends ServerlessRoutines, Provider extends CloudProvider> = {
	functionName: string;
	type: T;
	payload: Omit<ServerlessPayloads<Provider>[T], 'type'>;
	region: Provider['region'];
	timeoutInTest: number;
};

const parseJsonOrThrowSource = (data: Uint8Array, type: string) => {
	const asString = new TextDecoder('utf-8').decode(data);
	try {
		return JSON.parse(asString);
	} catch (err) {
		throw new Error(`Invalid JSON (${type}): ${asString}`);
	}
};

export const callLambda = async <
	Provider extends CloudProvider,
	T extends ServerlessRoutines,
>(
	options: Options<T, Provider>,
): Promise<LambdaReturnValues<Provider>[T]> => {
	// Do not remove this await
	const res = await callLambdaWithoutRetry<T, Provider>(options);
	if (res.type === 'error') {
		const err = new Error(res.message);
		err.stack = res.stack;
		throw err;
	}

	return res;
};

export const callLambdaWithStreaming = async <
	Provider extends CloudProvider,
	T extends ServerlessRoutines,
>(
	options: Options<T, Provider> & {
		receivedStreamingPayload: OnMessage<Provider>;
		retriesRemaining: number;
	},
): Promise<void> => {
	// As of August 2023, Lambda streaming sometimes misses parts of the JSON response.
	// Handling this for now by applying a retry mechanism.

	try {
		// Do not remove this await
		await callLambdaWithStreamingWithoutRetry<T, Provider>(options);
	} catch (err) {
		if ((err as Error).message.includes('TooManyRequestsException')) {
			throw new Error(
				`AWS Concurrency limit reached (Original Error: ${(err as Error).message}). See https://www.remotion.dev/docs/lambda/troubleshooting/rate-limit for tips to fix this.`,
			);
		}

		if (
			!(err as Error).message.includes(INVALID_JSON_MESSAGE) &&
			!(err as Error).message.includes(LAMBDA_STREAM_STALL) &&
			!(err as Error).message.includes('aborted')
		) {
			throw err;
		}

		console.error('Retries remaining:', options.retriesRemaining);
		if (options.retriesRemaining === 0) {
			console.error('Throwing error:');
			throw err;
		}

		console.error(err);
		return callLambdaWithStreaming({
			...options,
			retriesRemaining: options.retriesRemaining - 1,
		});
	}
};

const callLambdaWithoutRetry = async <
	T extends ServerlessRoutines,
	Provider extends CloudProvider,
>({
	functionName,
	type,
	payload,
	region,
	timeoutInTest,
}: Options<T, Provider>): Promise<OrError<LambdaReturnValues<Provider>[T]>> => {
	const Payload = JSON.stringify({type, ...payload});
	const res = await getLambdaClient(region as AwsRegion, timeoutInTest).send(
		new InvokeCommand({
			FunctionName: functionName,
			Payload,
			InvocationType: 'RequestResponse',
		}),
	);

	const decoded = new TextDecoder('utf-8').decode(res.Payload);

	try {
		return JSON.parse(decoded) as OrError<LambdaReturnValues<Provider>[T]>;
	} catch (err) {
		throw new Error(`Invalid JSON (${type}): ${JSON.stringify(decoded)}`);
	}
};

const STREAM_STALL_TIMEOUT = 30000;
const LAMBDA_STREAM_STALL = `AWS did not invoke Lambda in ${STREAM_STALL_TIMEOUT}ms`;

const invokeStreamOrTimeout = async <Provider extends CloudProvider>({
	region,
	timeoutInTest,
	functionName,
	type,
	payload,
}: {
	region: Provider['region'];
	timeoutInTest: number;
	functionName: string;
	type: string;
	payload: Record<string, unknown>;
}) => {
	const resProm = getLambdaClient(region as AwsRegion, timeoutInTest).send(
		new InvokeWithResponseStreamCommand({
			FunctionName: functionName,
			Payload: JSON.stringify({type, ...payload}),
		}),
	);

	let cleanup = () => undefined;

	const timeout = new Promise<InvokeWithResponseStreamCommandOutput>(
		(_resolve, reject) => {
			const int = setTimeout(() => {
				reject(new Error(LAMBDA_STREAM_STALL));
			}, STREAM_STALL_TIMEOUT);
			cleanup = () => {
				clearTimeout(int);
			};
		},
	);

	const res = await Promise.race([resProm, timeout]);

	cleanup();

	return res;
};

const callLambdaWithStreamingWithoutRetry = async <
	T extends ServerlessRoutines,
	Provider extends CloudProvider,
>({
	functionName,
	type,
	payload,
	region,
	timeoutInTest,
	receivedStreamingPayload,
}: Options<T, Provider> & {
	receivedStreamingPayload: OnMessage<Provider>;
}): Promise<void> => {
	const res = await invokeStreamOrTimeout({
		functionName,
		payload,
		region,
		timeoutInTest,
		type,
	});

	const {onData, clear} = makeStreamer((status, messageTypeId, data) => {
		const messageType = messageTypeIdToMessageType(
			messageTypeId as MessageTypeId,
		);
		const innerPayload =
			formatMap[messageType] === 'json'
				? parseJsonOrThrowSource(data, messageType)
				: data;

		const message: StreamingMessage<Provider> = {
			successType: status,
			message: {
				type: messageType,
				payload: innerPayload,
			},
		};

		receivedStreamingPayload(message);
	});

	const dumpBuffers = () => {
		clear();
	};

	// @ts-expect-error - We are adding a listener to a global variable
	if (globalThis._dumpUnreleasedBuffers) {
		// @ts-expect-error - We are adding a listener to a global variable
		(globalThis._dumpUnreleasedBuffers as EventEmitter).addListener(
			'dump-unreleased-buffers',
			dumpBuffers,
		);
	}

	const events =
		res.EventStream as AsyncIterable<InvokeWithResponseStreamResponseEvent>;

	for await (const event of events) {
		// There are two types of events you can get on a stream.

		// `PayloadChunk`: These contain the actual raw bytes of the chunk
		// It has a single property: `Payload`
		if (event.PayloadChunk && event.PayloadChunk.Payload) {
			onData(event.PayloadChunk.Payload);
		}

		if (event.InvokeComplete) {
			if (event.InvokeComplete.ErrorCode) {
				const logs = `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:logs-insights$3FqueryDetail$3D~(end~0~start~-3600~timeType~'RELATIVE~unit~'seconds~editorString~'fields*20*40timestamp*2c*20*40requestId*2c*20*40message*0a*7c*20filter*20*40requestId*20like*20*${res.$metadata.requestId}*22*0a*7c*20sort*20*40timestamp*20asc~source~(~'*2faws*2flambda*2f${functionName}))`;
				if (event.InvokeComplete.ErrorCode === 'Unhandled') {
					throw new Error(
						`Lambda function ${functionName} failed with an unhandled error: ${
							event.InvokeComplete.ErrorDetails as string
						} See ${logs} to see the logs of this invocation.`,
					);
				}

				throw new Error(
					`Lambda function ${functionName} failed with error code ${event.InvokeComplete.ErrorCode}: ${event.InvokeComplete.ErrorDetails}. See ${logs} to see the logs of this invocation.`,
				);
			}
		}

		// Don't put a `break` statement here, as it will cause the socket to not properly exit.
	}

	// @ts-expect-error - We are adding a listener to a global variable
	if (globalThis._dumpUnreleasedBuffers) {
		// @ts-expect-error - We are adding a listener to a global variable
		(globalThis._dumpUnreleasedBuffers as EventEmitter).removeListener(
			'dump-unreleased-buffers',
			dumpBuffers,
		);
	}

	clear();
};
