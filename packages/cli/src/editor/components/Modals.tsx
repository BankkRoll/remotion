import React, {useContext} from 'react';
import {PreviewServerConnectionCtx} from '../helpers/client-id';
import {ModalsContext} from '../state/modals';
import NewComposition from './NewComposition/NewComposition';
import QuickSwitcher from './QuickSwitcher/QuickSwitcher';
import {RenderErrorModal} from './RenderModal/RenderErrorModal';
import {RenderModal} from './RenderModal/RenderModal';
import {RenderProgressModal} from './RenderModal/RenderProgressModal';
import {UpdateModal} from './UpdateModal/UpdateModal';

export const Modals: React.FC = () => {
	const {selectedModal: modalContextType} = useContext(ModalsContext);
	const canRender = useContext(PreviewServerConnectionCtx).type === 'connected';

	return (
		<>
			{modalContextType && modalContextType.type === 'new-comp' && (
				<NewComposition initialCompType={modalContextType.compType} />
			)}

			{modalContextType && canRender && modalContextType.type === 'render' && (
				<RenderModal
					initialFrame={modalContextType.initialFrame}
					compositionId={modalContextType.compositionId}
					initialVideoImageFormat={modalContextType.initialVideoImageFormat}
					initialQuality={modalContextType.initialQuality}
					initialOutName={modalContextType.initialOutName}
					initialScale={modalContextType.initialScale}
					initialVerbose={modalContextType.initialVerbose}
					initialRenderType={modalContextType.initialRenderType}
					initialVideoCodecForAudioTab={
						modalContextType.initialVideoCodecForAudioTab
					}
					initialVideoCodecForVideoTab={
						modalContextType.initialVideoCodecForVideoTab
					}
					initialConcurrency={modalContextType.initialConcurrency}
					maxConcurrency={modalContextType.maxConcurrency}
					minConcurrency={modalContextType.minConcurrency}
					initialStillImageFormat={modalContextType.initialStillImageFormat}
					initialMuted={modalContextType.initialMuted}
					initialEnforceAudioTrack={modalContextType.initialEnforceAudioTrack}
					initialProResProfile={modalContextType.initialProResProfile}
					initialPixelFormat={modalContextType.initialPixelFormat}
					initialAudioBitrate={modalContextType.initialAudioBitrate}
					initialVideoBitrate={modalContextType.initialVideoBitrate}
					initialEveryNthFrame={modalContextType.initialEveryNthFrame}
					initialNumberOfGifLoops={modalContextType.initialNumberOfGifLoops}
					initialDelayRenderTimeout={modalContextType.initialDelayRenderTimeout}
					initialAudioCodec={modalContextType.initialAudioCodec}
				/>
			)}

			{modalContextType &&
				canRender &&
				modalContextType.type === 'render-error' && (
					<RenderErrorModal job={modalContextType.job} />
				)}
			{modalContextType &&
				canRender &&
				modalContextType.type === 'render-progress' && (
					<RenderProgressModal jobId={modalContextType.jobId} />
				)}

			{modalContextType && modalContextType.type === 'update' && (
				<UpdateModal info={modalContextType.info} />
			)}

			{modalContextType && modalContextType.type === 'quick-switcher' && (
				<QuickSwitcher
					invocationTimestamp={modalContextType.invocationTimestamp}
					initialMode={modalContextType.mode}
				/>
			)}
		</>
	);
};
