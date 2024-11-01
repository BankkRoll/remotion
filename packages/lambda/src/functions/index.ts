import {RenderInternals} from '@remotion/renderer';
import type {
	CloudProvider,
	ProviderSpecifics,
	ResponseStream,
	ResponseStreamWriter,
	StreamingPayload,
} from '@remotion/serverless';
import {
	compositionsHandler,
	infoHandler,
	streamWriter,
} from '@remotion/serverless';
import type {ServerlessPayload} from '@remotion/serverless/client';
import {
	ServerlessRoutines,
	makeStreamPayload,
} from '@remotion/serverless/client';
import {COMMAND_NOT_FOUND} from '../shared/constants';
import type {AwsProvider} from './aws-implementation';
import {awsImplementation} from './aws-implementation';
import {deleteTmpDir} from './helpers/clean-tmpdir';
import {getWarm, setWarm} from './helpers/is-warm';
import {setCurrentRequestId, stopLeakDetection} from './helpers/leak-detection';
import {
	generateRandomHashWithLifeCycleRule,
	validateDeleteAfter,
} from './helpers/lifecycle';
import {printLoggingGrepHelper} from './helpers/print-logging-helper';
import type {RequestContext} from './helpers/request-context';
import {streamifyResponse} from './helpers/streamify-response';
import {launchHandler} from './launch';
import {progressHandler} from './progress';
import {rendererHandler} from './renderer';
import {startHandler} from './start';
import {stillHandler} from './still';

const innerHandler = async <Provider extends CloudProvider>({
	params,
	responseWriter,
	context,
	providerSpecifics,
}: {
	params: ServerlessPayload<Provider>;
	responseWriter: ResponseStreamWriter;
	context: RequestContext;
	providerSpecifics: ProviderSpecifics<Provider>;
}): Promise<void> => {
	setCurrentRequestId(context.awsRequestId);
	process.env.__RESERVED_IS_INSIDE_REMOTION_LAMBDA = 'true';
	const timeoutInMilliseconds = context.getRemainingTimeInMillis();

	RenderInternals.Log.verbose(
		{indent: false, logLevel: params.logLevel},
		'AWS Request ID:',
		context.awsRequestId,
	);
	stopLeakDetection();
	if (!context?.invokedFunctionArn) {
		throw new Error(
			'Lambda function unexpectedly does not have context.invokedFunctionArn',
		);
	}

	deleteTmpDir();
	const isWarm = getWarm();
	setWarm();

	const currentUserId = context.invokedFunctionArn.split(':')[4];
	if (params.type === ServerlessRoutines.still) {
		validateDeleteAfter(params.deleteAfter);
		const renderId = generateRandomHashWithLifeCycleRule(
			params.deleteAfter,
			providerSpecifics,
		);
		if (providerSpecifics.printLoggingHelper) {
			printLoggingGrepHelper(
				ServerlessRoutines.still,
				{
					renderId,
					inputProps: JSON.stringify(params.inputProps),
					isWarm,
				},
				params.logLevel,
			);
		}

		try {
			await new Promise((resolve, reject) => {
				const onStream = (payload: StreamingPayload<Provider>) => {
					const message = makeStreamPayload({
						message: payload,
					});
					return new Promise<void>((innerResolve, innerReject) => {
						responseWriter
							.write(message)
							.then(() => {
								innerResolve();
							})
							.catch((err) => {
								reject(err);
								innerReject(err);
							});
					});
				};

				if (params.streamed) {
					onStream({
						type: 'render-id-determined',
						payload: {renderId},
					});
				}

				stillHandler({
					expectedBucketOwner: currentUserId,
					params,
					renderId,
					onStream,
					timeoutInMilliseconds,
					providerSpecifics,
				})
					.then((r) => {
						resolve(r);
					})
					.catch((err) => {
						reject(err);
					});
			});
			await responseWriter.end();
		} catch (err) {
			console.log({err});
		}

		return;
	}

	if (params.type === ServerlessRoutines.start) {
		const renderId = generateRandomHashWithLifeCycleRule(
			params.deleteAfter,
			providerSpecifics,
		);

		if (providerSpecifics.printLoggingHelper) {
			printLoggingGrepHelper(
				ServerlessRoutines.start,
				{
					renderId,
					inputProps: JSON.stringify(params.inputProps),
					isWarm,
				},
				params.logLevel,
			);
		}

		const response = await startHandler(
			params,
			{
				expectedBucketOwner: currentUserId,
				timeoutInMilliseconds,
				renderId,
			},
			providerSpecifics,
		);

		await responseWriter.write(Buffer.from(JSON.stringify(response)));
		await responseWriter.end();
		return;
	}

	if (params.type === ServerlessRoutines.launch) {
		if (providerSpecifics.printLoggingHelper) {
			printLoggingGrepHelper(
				ServerlessRoutines.launch,
				{
					renderId: params.renderId,
					inputProps: JSON.stringify(params.inputProps),
					isWarm,
				},
				params.logLevel,
			);
		}

		const response = await launchHandler(
			params,
			{
				expectedBucketOwner: currentUserId,
				getRemainingTimeInMillis: context.getRemainingTimeInMillis,
			},
			providerSpecifics,
		);

		await responseWriter.write(Buffer.from(JSON.stringify(response)));
		await responseWriter.end();
		return;
	}

	if (params.type === ServerlessRoutines.status) {
		if (providerSpecifics.printLoggingHelper) {
			printLoggingGrepHelper(
				ServerlessRoutines.status,
				{
					renderId: params.renderId,
					isWarm,
				},
				params.logLevel,
			);
		}

		const response = await progressHandler(params, {
			expectedBucketOwner: currentUserId,
			timeoutInMilliseconds,
			retriesRemaining: 2,
			providerSpecifics,
		});

		await responseWriter.write(Buffer.from(JSON.stringify(response)));
		await responseWriter.end();
		return;
	}

	if (params.type === ServerlessRoutines.renderer) {
		if (providerSpecifics.printLoggingHelper) {
			printLoggingGrepHelper(
				ServerlessRoutines.renderer,
				{
					renderId: params.renderId,
					chunk: String(params.chunk),
					dumpLogs: String(
						RenderInternals.isEqualOrBelowLogLevel(params.logLevel, 'verbose'),
					),
					resolvedProps: JSON.stringify(params.resolvedProps),
					isWarm,
				},
				params.logLevel,
			);
		}

		await new Promise((resolve, reject) => {
			rendererHandler({
				params,
				options: {
					expectedBucketOwner: currentUserId,
					isWarm,
				},
				onStream: (payload) => {
					const message = makeStreamPayload({
						message: payload,
					});

					const writeProm = responseWriter.write(message);

					return new Promise((innerResolve, innerReject) => {
						writeProm
							.then(() => {
								innerResolve();
							})
							.catch((err) => {
								reject(err);
								innerReject(err);
							});
					});
				},
				requestContext: context,
				providerSpecifics,
			})
				.then((res) => {
					resolve(res);
				})
				.catch((err) => {
					reject(err);
				});
		});

		await responseWriter.end();

		return;
	}

	if (params.type === ServerlessRoutines.info) {
		if (providerSpecifics.printLoggingHelper) {
			printLoggingGrepHelper(
				ServerlessRoutines.info,
				{
					isWarm,
				},
				params.logLevel,
			);
		}

		const response = await infoHandler(params);
		await responseWriter.write(Buffer.from(JSON.stringify(response)));
		await responseWriter.end();
		return;
	}

	if (params.type === ServerlessRoutines.compositions) {
		if (providerSpecifics.printLoggingHelper) {
			printLoggingGrepHelper(
				ServerlessRoutines.compositions,
				{
					isWarm,
				},
				params.logLevel,
			);
		}

		const response = await compositionsHandler(
			params,
			{
				expectedBucketOwner: currentUserId,
			},
			providerSpecifics,
		);

		await responseWriter.write(Buffer.from(JSON.stringify(response)));
		await responseWriter.end();

		return;
	}

	throw new Error(COMMAND_NOT_FOUND);
};

export type OrError<T> =
	| T
	| {
			type: 'error';
			message: string;
			stack: string;
	  };

export const innerRoutine = async <Provider extends CloudProvider>(
	params: ServerlessPayload<Provider>,
	responseStream: ResponseStream,
	context: RequestContext,
	providerSpecifics: ProviderSpecifics<Provider>,
): Promise<void> => {
	const responseWriter = streamWriter(responseStream);

	try {
		await innerHandler({
			params,
			responseWriter,
			context,
			providerSpecifics,
		});
	} catch (err) {
		const res: OrError<0> = {
			type: 'error',
			message: (err as Error).message,
			stack: (err as Error).stack as string,
		};

		await responseWriter.write(Buffer.from(JSON.stringify(res)));
		await responseWriter.end();
	}
};

export const routine = (
	params: ServerlessPayload<AwsProvider>,
	responseStream: ResponseStream,
	context: RequestContext,
): Promise<void> => {
	return innerRoutine(params, responseStream, context, awsImplementation);
};

export const handler = streamifyResponse(routine);
