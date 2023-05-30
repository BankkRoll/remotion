/**
 * @vitest-environment jsdom
 */
import {render} from '@testing-library/react';
import React from 'react';
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
	vitest,
} from 'vitest';
import {AudioForRendering} from '../audio/AudioForRendering.js';
import {CanUseRemotionHooksProvider} from '../CanUseRemotionHooks.js';
import type {CompositionManagerContext} from '../CompositionManagerContext.js';
import {CompositionManager} from '../CompositionManagerContext.js';
import {ResolveCompositionConfig} from '../ResolveCompositionConfig.js';
import {expectToThrow} from './expect-to-throw.js';

interface MockCompositionManagerContext {
	MockProvider: Function;
	registerAsset: Function;
	unregisterAsset: Function;
}
let mockContext: MockCompositionManagerContext;

describe('Register and unregister asset', () => {
	function createMockContext(): MockCompositionManagerContext {
		const registerAsset = vitest.fn();
		const unregisterAsset = vitest.fn();
		window.remotion_audioEnabled = true;
		const MockProvider: React.FC<{
			children: React.ReactNode;
		}> = ({children}) => {
			return (
				<CanUseRemotionHooksProvider>
					<ResolveCompositionConfig>
						<CompositionManager.Provider
							value={
								// eslint-disable-next-line react/jsx-no-constructed-context-values
								{
									registerAsset,
									unregisterAsset,
								} as unknown as CompositionManagerContext
							}
						>
							{children}
						</CompositionManager.Provider>
					</ResolveCompositionConfig>
				</CanUseRemotionHooksProvider>
			);
		};

		return {
			MockProvider,
			registerAsset,
			unregisterAsset,
		};
	}

	beforeEach(() => {
		mockContext = createMockContext();
	});

	test('register and unregister asset', () => {
		const props = {
			src: 'test',
			muted: false,
			volume: 50,
			onDuration: vitest.fn(),
		};
		const {unmount} = render(
			<CanUseRemotionHooksProvider>
				<mockContext.MockProvider>
					<AudioForRendering {...props} />
				</mockContext.MockProvider>
			</CanUseRemotionHooksProvider>
		);

		expect(mockContext.registerAsset).toHaveBeenCalled();
		unmount();
		expect(mockContext.unregisterAsset).toHaveBeenCalled();
	});

	test('no src passed', () => {
		const props = {
			src: undefined,
			muted: false,
			volume: 50,
			onDuration: vitest.fn(),
		};
		expectToThrow(() => {
			render(
				<CanUseRemotionHooksProvider>
					<mockContext.MockProvider>
						<AudioForRendering {...props} />
					</mockContext.MockProvider>
				</CanUseRemotionHooksProvider>
			);
		}, /No src passed/);
		expect(mockContext.registerAsset).not.toHaveBeenCalled();
		expect(mockContext.unregisterAsset).not.toHaveBeenCalled();
	});
});

let mockUseEffect: Function;
describe('useEffect tests', () => {
	const useEffectSpy = vitest.spyOn(React, 'useEffect');
	mockUseEffect = vitest.fn();
	beforeAll(() => {
		useEffectSpy.mockImplementation(() => {
			mockUseEffect();
		});
	});
	afterAll(() => {
		useEffectSpy.mockRestore();
	});
	test.skip('has registered', () => {
		const props = {
			src: 'test',
			muted: false,
			volume: 50,
			onDuration: vitest.fn(),
		};
		render(
			<CanUseRemotionHooksProvider>
				<AudioForRendering {...props} />{' '}
			</CanUseRemotionHooksProvider>
		);
		expect(mockUseEffect).toHaveBeenCalled();
	});
});
