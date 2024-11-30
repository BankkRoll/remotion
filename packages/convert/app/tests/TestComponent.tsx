import {Link} from '@remix-run/react';
import React from 'react';
import {TestStateDisplay} from '~/components/tests/TestStateDisplay';
import {Button} from '~/components/ui/button';
import {TestStructure, useTest} from './test-structure';

export const TestComponent: React.FC<{
	readonly test: TestStructure;
}> = ({test}) => {
	const {state, run} = useTest(test);

	return (
		<div className="border-black rounded border-2 p-4 bg-white">
			<div className="flex flex-row">
				<div>
					<div className="font-brand font-bold text-xl">{test.name}</div>
					<TestStateDisplay testState={state} />
				</div>
				<div className="flex-1" />
				{state.type === 'not-run' ? (
					<Button onClick={run}>Run test</Button>
				) : null}
				<Link to={`/convert?url=${encodeURIComponent(test.src)}`}>
					Go to UI
				</Link>
			</div>
		</div>
	);
};
