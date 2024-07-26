import type {Codec} from '@remotion/renderer';
import {NoReactAPIs} from '@remotion/renderer/pure';
import type {
	CustomCredentials,
	OutNameInput,
} from '@remotion/serverless/client';
import type {OutNameOutput, RenderMetadata} from '../../defaults';
import {customOutName, outName, outStillName} from '../../defaults';
import {validateOutname} from '../../shared/validate-outname';
import {getCustomOutName} from './get-custom-out-name';

export const getCredentialsFromOutName = <Region extends string>(
	name: OutNameInput<Region> | null,
): CustomCredentials<Region> | null => {
	if (typeof name === 'string') {
		return null;
	}

	if (name === null) {
		return null;
	}

	if (typeof name === 'undefined') {
		return null;
	}

	return name.s3OutputProvider ?? null;
};

export const getExpectedOutName = <Region extends string>(
	renderMetadata: RenderMetadata,
	bucketName: string,
	customCredentials: CustomCredentials<Region> | null,
): OutNameOutput<Region> => {
	const outNameValue = getCustomOutName({
		customCredentials,
		renderMetadata,
	});
	if (outNameValue) {
		validateOutname({
			outName: outNameValue,
			codec: renderMetadata.codec,
			audioCodecSetting: renderMetadata.audioCodec,
			separateAudioTo: null,
		});
		return customOutName(renderMetadata.renderId, bucketName, outNameValue);
	}

	if (renderMetadata.type === 'still') {
		return {
			renderBucketName: bucketName,
			key: outStillName(renderMetadata.renderId, renderMetadata.imageFormat),
			customCredentials: null,
		};
	}

	if (renderMetadata.type === 'video') {
		return {
			renderBucketName: bucketName,
			key: outName(
				renderMetadata.renderId,
				NoReactAPIs.getFileExtensionFromCodec(
					renderMetadata.codec as Codec,
					renderMetadata.audioCodec,
				),
			),
			customCredentials: null,
		};
	}

	throw new TypeError('no type passed');
};
