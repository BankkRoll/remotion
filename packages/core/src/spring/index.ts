import {measureSpring} from './measure-spring';
import type {SpringConfig} from './spring-utils';
import {springCalculation} from './spring-utils';

/**
 * Calculates a position based on physical parameters, start and end value, and time.
 * @link https://www.remotion.dev/docs/spring
 * @param {number} frame The current time value. Most of the time you want to pass in the return value of useCurrentFrame.
 * @param {number} fps The framerate at which the animation runs. Pass in the value obtained by `useVideoConfig()`.
 * @param {?Object} config optional object that allows you to customize the physical properties of the animation.
 * @param {number} [config.mass=1] The weight of the spring. If you reduce the mass, the animation becomes faster!
 * @param {number} [config.damping=10] How hard the animation decelerates.
 * @param {number} [config.stiffness=100] Affects bounciness of the animation.
 * @param {boolean} [config.overshootClamping=false] Whether to prevent the animation going beyond the target value.
 * @param {?number} [config.from] The initial value of the animation. Default `0`
 * @param {?number} [config.to] The end value of the animation. Default `1`
 */
export function spring({
	frame,
	fps,
	config = {},
	from = 0,
	to = 1,
	duration,
	durationThreshold,
}: {
	frame: number;
	fps: number;
	config?: Partial<SpringConfig>;
	from?: number;
	to?: number;
	duration?: number;
	durationThreshold?: number;
}): number {
	const durationRatio = duration
		? duration /
		  measureSpring({fps, config, from, to, threshold: durationThreshold})
		: 1;

	const spr = springCalculation({
		fps,
		frame: frame / durationRatio,
		config,
		from,
		to,
	});

	if (!config.overshootClamping) {
		return spr.current;
	}

	if (to >= from) {
		return Math.min(spr.current, to);
	}

	return Math.max(spr.current, to);
}

export {measureSpring} from './measure-spring';
export {SpringConfig} from './spring-utils';
