import {TransitionSeries} from '@remotion/transitions';
import {
	makeEasingTiming,
	makeSpringTiming,
} from '@remotion/transitions/src/timing';
import {AbsoluteFill, Easing} from 'remotion';

export const BasicTransition: React.FC = () => {
	return (
		<TransitionSeries>
			<TransitionSeries.Sequence durationInFrames={90}>
				<AbsoluteFill
					style={{
						backgroundColor: 'orange',
						opacity: 0.5,
						justifyContent: 'center',
						alignItems: 'center',
						fontSize: 200,
						color: 'white',
					}}
				>
					A
				</AbsoluteFill>
			</TransitionSeries.Sequence>
			<TransitionSeries.Transition
				preset={{
					type: 'triangle',
				}}
				timing={makeEasingTiming({
					durationInFrames: 30,
					easing: Easing.bounce,
				})}
			/>
			<TransitionSeries.Sequence durationInFrames={90}>
				<AbsoluteFill
					style={{
						backgroundColor: 'green',
						opacity: 0.5,
						justifyContent: 'center',
						alignItems: 'center',
						fontSize: 200,
						color: 'white',
					}}
				>
					B
				</AbsoluteFill>
			</TransitionSeries.Sequence>
			<TransitionSeries.Transition
				preset={{
					type: 'slide',
				}}
				timing={makeSpringTiming({
					config: {
						damping: 200,
					},
				})}
			/>
			<TransitionSeries.Sequence durationInFrames={90}>
				<AbsoluteFill
					style={{
						backgroundColor: 'blue',
						opacity: 0.5,
						justifyContent: 'center',
						alignItems: 'center',
						fontSize: 200,
						color: 'white',
					}}
				>
					C
				</AbsoluteFill>
			</TransitionSeries.Sequence>
		</TransitionSeries>
	);
};
