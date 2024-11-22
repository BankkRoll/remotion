import type {ConvertMediaVideoCodec} from './codec-id';
import type {ConvertMediaContainer} from './get-available-containers';

export const getDefaultVideoCodec = ({
	container,
}: {
	container: ConvertMediaContainer;
}): ConvertMediaVideoCodec | null => {
	if (container === 'webm') {
		return 'vp8';
	}

	if (container === 'mp4') {
		return 'h264';
	}

	if (container === 'wav') {
		return null;
	}

	throw new Error(`Unhandled container: ${container satisfies never}`);
};
