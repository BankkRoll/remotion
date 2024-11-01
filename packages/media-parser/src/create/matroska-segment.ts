import {makeMatroskaBytes} from '../boxes/webm/make-header';
import type {BytesAndOffset} from '../boxes/webm/segments/all-segments';

export const MATROSKA_SEGMENT_MIN_VINT_WIDTH = 8;

export const createMatroskaSegment = (children: BytesAndOffset[]) => {
	return makeMatroskaBytes({
		type: 'Segment',
		value: children,
		minVintWidth: MATROSKA_SEGMENT_MIN_VINT_WIDTH,
	});
};
