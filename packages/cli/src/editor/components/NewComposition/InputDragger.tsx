import React, {
	InputHTMLAttributes,
	MouseEventHandler,
	PointerEventHandler,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {interpolate} from 'remotion';
import {getClickLock, setClickLock} from '../../state/input-dragger-click-lock';
import {inputBaseStyle, RemotionInput} from './RemInput';

type Props = InputHTMLAttributes<HTMLInputElement> & {
	onValueChange: (newVal: number) => void;
};

export const InputDragger: React.FC<Props> = ({onValueChange, ...props}) => {
	const [inputFallback, setInputFallback] = useState(false);
	const fallbackRef = useRef<HTMLInputElement>(null);

	const style = useMemo(() => {
		return {
			...inputBaseStyle,
			backgroundColor: 'transparent',
			borderColor: 'transparent',
		};
	}, []);

	const span: React.CSSProperties = useMemo(
		() => ({
			borderBottom: '1px dotted var(--blue)',
			paddingBottom: 1,
			color: 'var(--blue)',
			cursor: 'ew-resize',
			userSelect: 'none',
		}),
		[]
	);

	const onClick: MouseEventHandler<HTMLButtonElement> = useCallback((e) => {
		if (!getClickLock()) {
			e.stopPropagation();
		}

		if (getClickLock()) {
			return;
		}

		setInputFallback(true);
	}, []);

	const onBlur = useCallback(() => {
		setInputFallback(false);
	}, []);

	const onKeyPress: React.KeyboardEventHandler<HTMLInputElement> = useCallback(
		(e) => {
			if (e.key === 'Enter') {
				setInputFallback(false);
			}
		},
		[]
	);

	const onPointerDown: PointerEventHandler = useCallback(
		(e) => {
			const {pageX, pageY} = e;
			const moveListener = (ev: MouseEvent) => {
				const xDistance = ev.pageX - pageX;
				const distanceFromStart = Math.sqrt(
					xDistance ** 2 + (ev.pageY - pageY) ** 2
				);
				const step = Number(props.step ?? 1);
				const min = Number(props.min ?? 0);
				if (distanceFromStart > 4) {
					setClickLock(true);
				}

				const diff = interpolate(
					xDistance,
					[-5, -4, 0, 4, 5],
					[-step, 0, 0, 0, step]
				);
				const newValue = Math.max(min, Math.floor(Number(props.value) + diff));
				const roundToStep = Math.floor(newValue / step) * step;
				onValueChange(roundToStep);
			};

			window.addEventListener('mousemove', moveListener);
			window.addEventListener(
				'pointerup',
				() => {
					window.removeEventListener('mousemove', moveListener);
					setTimeout(() => {
						setClickLock(false);
					}, 2);
				},
				{
					once: true,
				}
			);
		},
		[onValueChange, props.min, props.step, props.value]
	);

	useEffect(() => {
		if (inputFallback) {
			fallbackRef.current?.select();
		}
	}, [inputFallback]);

	if (inputFallback) {
		return (
			<RemotionInput
				ref={fallbackRef}
				autoFocus
				onKeyPress={onKeyPress}
				onBlur={onBlur}
				{...props}
			/>
		);
	}

	return (
		<button
			type="button"
			style={style}
			onClick={onClick}
			onPointerDown={onPointerDown}
		>
			<span style={span}>{props.value}</span>
		</button>
	);
};
