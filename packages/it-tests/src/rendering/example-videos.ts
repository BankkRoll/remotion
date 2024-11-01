import path from 'node:path';

const examplePackage = path.join(__dirname, '..', '..', '..', 'example');
const docsPackage = path.join(__dirname, '..', '..', '..', 'docs');

export const exampleVideos = {
	bigBuckBunny: path.join(examplePackage, 'public/bigbuckbunny.mp4'),
	transparentWebm: path.join(docsPackage, '/static/img/transparent-video.webm'),
	framerWithoutFileExtension: path.join(
		examplePackage,
		'public',
		'framermp4withoutfileextension',
	),
	corrupted: path.join(examplePackage, 'public', 'corrupted.mp4'),
	customDar: path.join(examplePackage, 'public', 'custom-dar.mp4'),
	screenrecording: path.join(examplePackage, 'public', 'quick.mov'),
	nofps: path.join(examplePackage, 'public', 'nofps.webm'),
	variablefps: path.join(examplePackage, 'public', 'variablefps.webm'),
	zerotimestamp: path.join(examplePackage, 'public', 'zero-timestamp.mp4'),
	webcam: path.join(examplePackage, 'public', 'webcam.webm'),
	iphonevideo: path.join(examplePackage, 'public', 'iphonevideo.mov'),
	av1: path.join(examplePackage, 'public', 'av1.webm'),
	framer24fps: path.join(
		examplePackage,
		'src',
		'resources',
		'framer-24fps.mp4',
	),
	matroskaPcm16: path.join(examplePackage, 'public', 'matroska-pcm16.mkv'),
	mp4withmp3: path.join(examplePackage, 'public', 'mp4-mp3.mp4'),
};
