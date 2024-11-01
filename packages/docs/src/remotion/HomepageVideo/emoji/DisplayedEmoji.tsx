import type {EmojiName} from '@remotion/animated-emoji';
import type {LottieAnimationData} from '@remotion/lottie';
import {getLottieMetadata, Lottie} from '@remotion/lottie';
import React, {useEffect, useMemo, useState} from 'react';
import {
	cancelRender,
	continueRender,
	delayRender,
	useVideoConfig,
} from 'remotion';

export const DisplayedEmoji: React.FC<{
	readonly emoji: EmojiName;
}> = ({emoji}) => {
	const [data, setData] = useState<LottieAnimationData | null>(null);
	const {durationInFrames, fps} = useVideoConfig();

	const src = useMemo(() => {
		if (emoji === 'melting') {
			return 'https://fonts.gstatic.com/s/e/notoemoji/latest/1fae0/lottie.json';
		}

		if (emoji === 'partying-face') {
			return 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f973/lottie.json';
		}

		if (emoji === 'fire') {
			return 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/lottie.json';
		}

		throw new Error('Unknown emoji');
	}, [emoji]);

	const [handle] = useState(() => delayRender());

	useEffect(() => {
		fetch(src)
			.then((res) => res.json())
			.then((json) => {
				setData(json);
				continueRender(handle);
			})
			.catch((err) => {
				cancelRender(err);
			});
	}, [handle, src]);

	if (!data) {
		return null;
	}

	const animDurtion = getLottieMetadata(data)?.durationInSeconds as number;
	const ratio = durationInFrames / fps / animDurtion;
	const closestInteger = ratio;
	const closestRatio = closestInteger / ratio;

	return (
		<Lottie
			style={{
				height: 100,
				width: '100%',
				display: 'flex',
				justifyContent: 'center',
			}}
			loop
			animationData={data}
			playbackRate={closestRatio}
		/>
	);
};
