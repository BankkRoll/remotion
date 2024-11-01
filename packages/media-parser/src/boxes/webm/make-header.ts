import {getVariableInt} from './ebml';
import type {
	BytesAndOffset,
	FloatWithSize,
	OffsetAndChildren,
	PossibleEbml,
	PossibleEbmlOrUint8Array,
	UintWithSize,
} from './segments/all-segments';
import {
	ebmlMap,
	getIdForName,
	incrementOffsetAndChildren,
	matroskaElements,
} from './segments/all-segments';

export const webmPattern = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);

export const matroskaToHex = (
	matrId: (typeof matroskaElements)[keyof typeof matroskaElements],
) => {
	const numbers: Uint8Array = new Uint8Array((matrId.length - 2) / 2);

	for (let i = 2; i < matrId.length; i += 2) {
		const hex = matrId.substring(i, i + 2);
		numbers[(i - 2) / 2] = parseInt(hex, 16);
	}

	return numbers;
};

function putUintDynamic(number: number, minimumLength: number | null) {
	if (number < 0) {
		throw new Error(
			'This function is designed for non-negative integers only.',
		);
	}

	// Calculate the minimum number of bytes needed to store the integer
	const length = Math.max(
		minimumLength ?? 0,
		Math.ceil(Math.log2(number + 1) / 8),
	);
	const bytes = new Uint8Array(length);

	for (let i = 0; i < length; i++) {
		// Extract each byte from the number
		bytes[length - 1 - i] = (number >> (8 * i)) & 0xff;
	}

	return bytes;
}

const makeFromStructure = (
	fields: PossibleEbmlOrUint8Array,
): BytesAndOffset => {
	if ('bytes' in fields) {
		return fields;
	}

	const arrays: Uint8Array[] = [];

	const struct = ebmlMap[getIdForName(fields.type)];

	if (struct.type === 'uint8array') {
		return {
			bytes: fields.value as Uint8Array,
			offsets: {offset: 0, children: [], field: fields.type},
		};
	}

	if (struct.type === 'children') {
		const children: OffsetAndChildren[] = [];
		let bytesWritten = 0;
		for (const item of fields.value as PossibleEbml[]) {
			const {bytes, offsets} = makeMatroskaBytes(item);
			arrays.push(bytes);
			children.push(incrementOffsetAndChildren(offsets, bytesWritten));
			bytesWritten += bytes.byteLength;
		}

		return {
			bytes: combineUint8Arrays(arrays),
			offsets: {offset: 0, children, field: fields.type},
		};
	}

	if (struct.type === 'string') {
		return {
			bytes: new TextEncoder().encode(fields.value as string),
			offsets: {
				children: [],
				offset: 0,
				field: fields.type,
			},
		};
	}

	if (struct.type === 'uint') {
		return {
			bytes: putUintDynamic(
				(fields.value as UintWithSize).value,
				(fields.value as UintWithSize).byteLength,
			),
			offsets: {
				children: [],
				offset: 0,
				field: fields.type,
			},
		};
	}

	if (struct.type === 'hex-string') {
		const hex = (fields.value as string).substring(2);
		const arr = new Uint8Array(hex.length / 2);
		for (let i = 0; i < hex.length; i += 2) {
			const byte = parseInt(hex.substring(i, i + 2), 16);
			arr[i / 2] = byte;
		}

		return {
			bytes: arr,
			offsets: {
				children: [],
				offset: 0,
				field: fields.type,
			},
		};
	}

	if (struct.type === 'float') {
		const value = fields.value as FloatWithSize;
		if (value.size === '32') {
			const dataView = new DataView(new ArrayBuffer(4));
			dataView.setFloat32(0, value.value);
			return {
				bytes: new Uint8Array(dataView.buffer),
				offsets: {
					children: [],
					offset: 0,
					field: fields.type,
				},
			};
		}

		const dataView2 = new DataView(new ArrayBuffer(8));
		dataView2.setFloat64(0, value.value);
		return {
			bytes: new Uint8Array(dataView2.buffer),
			offsets: {
				children: [],
				offset: 0,
				field: fields.type,
			},
		};
	}

	throw new Error('Unexpected type');
};

export const makeMatroskaBytes = (
	fields: PossibleEbmlOrUint8Array,
): BytesAndOffset => {
	if ('bytes' in fields) {
		return fields;
	}

	const value = makeFromStructure(fields);
	const header = matroskaToHex(getIdForName(fields.type));
	const size = getVariableInt(value.bytes.length, fields.minVintWidth);

	const bytes = combineUint8Arrays([header, size, value.bytes]);

	return {
		bytes,
		offsets: {
			offset: value.offsets.offset,
			field: value.offsets.field,
			children: value.offsets.children.map((c) => {
				return incrementOffsetAndChildren(
					c,
					header.byteLength + size.byteLength,
				);
			}),
		},
	};
};

export const padMatroskaBytes = (
	fields: PossibleEbmlOrUint8Array,
	totalLength: number,
): BytesAndOffset[] => {
	const regular = makeMatroskaBytes(fields);
	const paddingLength =
		totalLength -
		regular.bytes.byteLength -
		matroskaToHex(matroskaElements.Void).byteLength;

	if (paddingLength < 0) {
		throw new Error('ooops');
	}

	const padding = makeMatroskaBytes({
		type: 'Void',
		value: new Uint8Array(paddingLength).fill(0),
		minVintWidth: null,
	});

	return [
		regular,
		{
			bytes: padding.bytes,
			offsets: incrementOffsetAndChildren(
				padding.offsets,
				regular.bytes.length,
			),
		},
	];
};

export const combineUint8Arrays = (arrays: Uint8Array[]) => {
	if (arrays.length === 0) {
		return new Uint8Array([]);
	}

	if (arrays.length === 1) {
		return arrays[0];
	}

	let totalLength = 0;
	for (const array of arrays) {
		totalLength += array.length;
	}

	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const array of arrays) {
		result.set(array, offset);
		offset += array.length;
	}

	return result;
};

export function serializeUint16(value: number): Uint8Array {
	const buffer = new ArrayBuffer(2);

	const view = new DataView(buffer);

	view.setUint16(0, value);

	return new Uint8Array(buffer);
}
